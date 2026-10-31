import React, { useEffect, useRef, useState } from 'react';
import { Stat, PageTitle, Status, Empty } from '../../components/common';
import './AttendancePage.css';

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('इस device/browser में GPS location उपलब्ध नहीं है।'));
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy), capturedAt: new Date().toISOString() }),
      error => reject(new Error(error.code === 1 ? 'Location permission allow करें, फिर दोबारा कोशिश करें।' : error.code === 2 ? 'GPS location नहीं मिल पाई। खुले स्थान पर दोबारा कोशिश करें।' : 'Location request timeout हुई। दोबारा कोशिश करें।')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export default function AttendancePage({ attendance, employees, checkIn, checkOut, todayKey, role, userId }) {
  const my = attendance.find(a => a.date === todayKey && a.employeeId === userId);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('checkin');
  const [captureError, setCaptureError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  function stopCamera() {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const play = async () => {
      try { await video.play(); } catch (error) { setCaptureError('Camera preview start नहीं हुआ। Browser में Camera permission Allow करके दोबारा कोशिश करें।'); }
    };
    play();
    return () => { if (video) video.srcObject = null; };
  }, [cameraOpen]);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
  }, []);

  async function openCapture(action) {
    setCaptureError(''); setCaptureStatus(''); setCameraReady(false); setPendingAction(action);
    if (action === 'checkin' && my) { setCaptureError('आज का check-in पहले से दर्ज है।'); return; }
    if (action === 'checkout' && (!my || my.checkOut)) { setCaptureError(my?.checkOut ? 'आज का check-out पहले से दर्ज है।' : 'पहले check-in करें।'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCaptureError('Camera access के लिए HTTPS website और supported browser ज़रूरी है।'); return; }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      setCaptureError(error.name === 'NotAllowedError' ? 'Camera permission Allow करें। Chrome में address bar के camera icon से permission बदलें।' : error.name === 'NotFoundError' ? 'इस device में camera नहीं मिला।' : `Camera start नहीं हो पाया: ${error.message || error.name}`);
    }
  }

  function waitForVideo(video, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (video?.readyState >= 2 && video.videoWidth > 0) return resolve();
      const timer = window.setTimeout(() => cleanup(new Error('Camera अभी तैयार नहीं हुआ। Preview में चेहरा दिखने तक इंतज़ार करें।')), timeout);
      const ready = () => { if (video.videoWidth > 0 && video.readyState >= 2) cleanup(); };
      const cleanup = error => {
        window.clearTimeout(timer);
        video.removeEventListener('loadeddata', ready);
        video.removeEventListener('canplay', ready);
        error ? reject(error) : resolve();
      };
      video.addEventListener('loadeddata', ready);
      video.addEventListener('canplay', ready);
      ready();
    });
  }

  async function captureAndSave() {
    if (capturing) return;
    setCapturing(true); setCaptureError(''); setCaptureStatus('Camera से selfie capture हो रही है…');
    try {
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview नहीं मिला। Cancel करके camera दोबारा खोलें।');
      await waitForVideo(video);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Selfie capture के लिए canvas उपलब्ध नहीं है।');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoBlob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Selfie image तैयार नहीं हो पाई।')), 'image/jpeg', 0.82));
      setCaptureStatus('GPS location प्राप्त हो रही है…');
      const location = await getLocation();
      setCaptureStatus('Selfie और GPS Firebase में save हो रहे हैं…');
      const payload = { photoBlob, location };
      if (pendingAction === 'checkin') await checkIn(payload); else await checkOut(payload);
      stopCamera(); setCameraOpen(false); setCaptureStatus('Attendance सफलतापूर्वक save हो गई।');
    } catch (error) {
      setCaptureError(error.message || 'Attendance save नहीं हो पाई।');
      setCaptureStatus('');
    } finally { setCapturing(false); }
  }

  const locationLink = loc => loc ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}` : '';
  return <div className="module-page module-page--attendance">
    <PageTitle eyebrow="PEOPLE OPERATIONS" title="Attendance & time" subtitle="Check in/out with a live selfie and GPS location." actions={<button className="btn secondary" onClick={() => window.print()}>⎙ Print report</button>} />
    <div className="attendance-hero panel"><div className="attendance-intro"><span className="eyebrow">TODAY'S WORKDAY</span><h2>{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</h2><p>Attendance submit करने के लिए camera और location permission दोनों ज़रूरी हैं।</p><div className="attendance-actions"><button className="btn primary" onClick={() => openCapture('checkin')} disabled={Boolean(my) || role === 'superadmin'}>📸 Check in with selfie</button><button className="btn secondary" onClick={() => openCapture('checkout')} disabled={!my || Boolean(my.checkOut) || role === 'superadmin'}>📍 Check out with selfie</button></div>{my && <div className="check-status"><span className="live-dot"/> Checked in at <b>{my.checkIn}</b>{my.checkOut && <> · Checked out at <b>{my.checkOut}</b></>}</div>}{captureError && !cameraOpen && <div className="attendance-error" role="alert">{captureError}</div>}</div><div className="clock-art"><div className="clock-face"><span>9</span><span>12</span><span>3</span><span>6</span><i className="clock-hand hour"/><i className="clock-hand minute"/><i className="clock-pin"/></div></div></div>
    {cameraOpen && <div className="attendance-camera panel"><div className="panel-head"><div><h3>{pendingAction === 'checkin' ? 'Check-in selfie' : 'Check-out selfie'}</h3><p>अपना चेहरा camera में रखें। Photo और GPS एक साथ attendance record में save होंगे।</p></div><button className="btn secondary" onClick={() => { stopCamera(); setCameraOpen(false); }}>Cancel</button></div><video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => { const v = videoRef.current; if (v && v.videoWidth > 0) setCameraReady(true); }} onCanPlay={() => setCameraReady(true)} className="attendance-video"/><div className="attendance-camera-actions"><button className="btn primary" type="button" onClick={captureAndSave} disabled={capturing || !cameraReady}>{capturing ? 'Capturing & saving…' : cameraReady ? 'Capture selfie + GPS' : 'Camera तैयार हो रहा है…'}</button></div>{captureStatus && <div className="attendance-status" role="status">{captureStatus}</div>}{captureError && <div className="attendance-error" role="alert">{captureError}</div>}<p className="attendance-privacy">Photo केवल आपकी company attendance record के लिए store होगी। Location accuracy device/GPS पर निर्भर करती है।</p></div>}
    <div className="stats-grid"><Stat label="Present today" value={attendance.filter(a => a.date === todayKey && a.status === 'Present').length} change="Check-ins recorded" icon="✓" tone="green" foot="Photo/GPS status in log"/><Stat label="Team size" value={employees.length} change="Employee roster" icon="♙" tone="purple" foot="Company workspace roster"/><Stat label="Checked out" value={attendance.filter(a => a.date === todayKey && a.checkOut).length} change="End-of-day recorded" icon="◷" tone="blue" foot="Today only"/><Stat label="Not checked out" value={attendance.filter(a => a.date === todayKey && !a.checkOut).length} change="May still be working" icon="!" tone="orange" foot="Confirm before payroll"/></div>
    <div className="panel"><div className="panel-head"><div><h3>Attendance log</h3><p>{todayKey} · Company attendance records</p></div><span className="table-count">{attendance.length} records</span></div><div className="table-wrap"><table><thead><tr><th>TEAM MEMBER</th><th>DATE</th><th>CHECK-IN</th><th>IN PHOTO / GPS</th><th>CHECK-OUT</th><th>OUT PHOTO / GPS</th><th>STATUS</th></tr></thead><tbody>{attendance.map((a, i) => <tr key={a.id}><td><div className="contact-cell"><div className={`tiny-avatar av-${i % 4}`}>{(a.name || '?')[0]}</div><b>{a.name}</b></div></td><td>{a.date}</td><td>{a.checkIn || '—'}</td><td>{a.checkInPhotoUrl ? <a href={a.checkInPhotoUrl} target="_blank" rel="noreferrer">View selfie</a> : 'No photo'}{a.checkInLocation && <small className="cell-sub"><a href={locationLink(a.checkInLocation)} target="_blank" rel="noreferrer">View map</a> · ±{a.checkInLocation.accuracy || '?'}m</small>}</td><td>{a.checkOut || '—'}</td><td>{a.checkOutPhotoUrl ? <a href={a.checkOutPhotoUrl} target="_blank" rel="noreferrer">View selfie</a> : '—'}{a.checkOutLocation && <small className="cell-sub"><a href={locationLink(a.checkOutLocation)} target="_blank" rel="noreferrer">View map</a> · ±{a.checkOutLocation.accuracy || '?'}m</small>}</td><td><Status value={a.status}/></td></tr>)}</tbody></table>{!attendance.length && <Empty title="No attendance records today" desc="Check in with a selfie and GPS to create the first record."/>}</div></div><div className="notice">GPS location is captured only after permission is granted. A browser-based selfie/GPS check improves attendance evidence but cannot guarantee protection against all spoofing.</div>
  </div>;
}
