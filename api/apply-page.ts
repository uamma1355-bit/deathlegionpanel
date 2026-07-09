import type { VercelRequest, VercelResponse } from '@vercel/node';

const APPLY_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Death Legion Panel — Apply</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0a0a;
      background-image: radial-gradient(ellipse at top, #1a1208 0%, #0a0a0a 60%);
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container { max-width: 520px; width: 100%; }
    .logo {
      font-family: 'Cinzel', serif;
      font-size: 2.8rem;
      font-weight: 900;
      text-align: center;
      margin-bottom: 0.3rem;
      background: linear-gradient(135deg, #bc6e3c 0%, #e89060 50%, #bc6e3c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .tagline {
      text-align: center;
      color: #888;
      font-size: 0.95rem;
      margin-bottom: 2rem;
    }
    .card {
      background: rgba(20, 20, 20, 0.8);
      border: 1px solid rgba(188, 110, 60, 0.2);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(10px);
    }
    .card-title {
      font-family: 'Cinzel', serif;
      font-size: 1.3rem;
      color: #e89060;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    .form-group { margin-bottom: 1.2rem; }
    .form-row { display: flex; gap: 1rem; }
    .form-row .form-group { flex: 1; }
    label { display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 0.4rem; }
    input {
      width: 100%; padding: 0.75rem 1rem;
      background: rgba(15,15,15,0.8);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; color: #fff;
      font-size: 0.95rem; font-family: 'Inter', sans-serif;
      transition: all 0.2s;
    }
    input:focus { outline: none; border-color: #bc6e3c; box-shadow: 0 0 0 3px rgba(188,110,60,0.15); }
    input::placeholder { color: #444; }
    .btn {
      width: 100%; padding: 0.85rem;
      background: linear-gradient(135deg, #bc6e3c 0%, #d97f4a 100%);
      border: none; border-radius: 8px; color: #fff;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(188,110,60,0.3); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .info {
      background: rgba(188,110,60,0.08);
      border: 1px solid rgba(188,110,60,0.15);
      border-radius: 8px; padding: 1rem;
      margin-bottom: 1.5rem; font-size: 0.85rem;
      color: #aaa; line-height: 1.5;
    }
    .info strong { color: #e89060; }
    .error {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.2);
      color: #ef4444; padding: 0.75rem 1rem;
      border-radius: 8px; font-size: 0.85rem;
      margin-bottom: 1rem; display: none;
    }
    .success { display: none; text-align: center; }
    .success .check { font-size: 3rem; color: #22c55e; margin-bottom: 1rem; }
    .success h2 { font-family: 'Cinzel', serif; color: #e89060; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .success p { color: #aaa; margin-bottom: 1.5rem; line-height: 1.6; }
    .success .credentials {
      background: rgba(15,15,15,0.8);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 1rem;
      margin-bottom: 1.5rem; text-align: left;
    }
    .success .credentials div { display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.9rem; }
    .success .credentials div span:first-child { color: #888; }
    .success .credentials div span:last-child { color: #e89060; font-family: monospace; }
    .login-link {
      display: inline-block; padding: 0.75rem 2rem;
      background: linear-gradient(135deg, #bc6e3c 0%, #d97f4a 100%);
      border: none; border-radius: 8px; color: #fff;
      text-decoration: none; font-weight: 600; transition: all 0.2s;
    }
    .login-link:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(188,110,60,0.3); }
    .spinner {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem; vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .progress { margin: 1.5rem 0; display: none; }
    .progress-step { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; color: #555; font-size: 0.85rem; }
    .progress-step.active { color: #e89060; }
    .progress-step.done { color: #22c55e; }
    .progress-step .dot { width: 8px; height: 8px; border-radius: 50%; background: #333; }
    .progress-step.active .dot { background: #e89060; animation: pulse 1s ease-in-out infinite; }
    .progress-step.done .dot { background: #22c55e; }
    .heavy-load {
      display: none;
      text-align: center;
      padding: 2rem;
    }
    .heavy-load .icon { font-size: 3rem; margin-bottom: 1rem; }
    .heavy-load h2 { font-family: 'Cinzel', serif; color: #f59e0b; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .heavy-load p { color: #aaa; margin-bottom: 1rem; line-height: 1.6; }
    .heavy-load .retry-btn {
      display: inline-block; padding: 0.75rem 2rem;
      background: linear-gradient(135deg, #bc6e3c 0%, #d97f4a 100%);
      border: none; border-radius: 8px; color: #fff;
      text-decoration: none; font-weight: 600; cursor: pointer;
      font-family: 'Inter', sans-serif; font-size: 1rem;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .beta-badge {
      position: fixed; top: 12px; right: 12px; z-index: 999;
      background: linear-gradient(135deg, #bc6e3c, #e89060);
      color: #fff; padding: 4px 12px; border-radius: 20px;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; font-family: 'Inter', sans-serif;
      box-shadow: 0 2px 10px rgba(188,110,60,0.3); pointer-events: none;
    }
    .legion-auth-section {
      margin-top: 1.5rem; padding-top: 1.5rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      text-align: center;
    }
    .legion-auth-section .divider {
      display: flex; align-items: center; margin-bottom: 1rem;
      color: #555; font-size: 0.8rem;
    }
    .legion-auth-section .divider::before, .legion-auth-section .divider::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08);
    }
    .legion-auth-section .divider span { padding: 0 0.75rem; }
    .legion-auth-btn {
      display: block; width: 100%; padding: 0.75rem;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(188,110,60,0.3); border-radius: 8px;
      color: #e89060; font-size: 0.9rem; font-weight: 600;
      text-align: center; cursor: pointer; transition: all 0.2s;
      text-decoration: none; font-family: 'Inter', sans-serif;
    }
    .legion-auth-btn:hover {
      transform: translateY(-1px); box-shadow: 0 4px 15px rgba(188,110,60,0.2);
      border-color: rgba(188,110,60,0.5);
    }
    .legion-auth-section p {
      color: #666; font-size: 0.8rem; margin-top: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="beta-badge">BETA</div>
  <div class="container">
    <div class="logo">Death Legion</div>
    <div class="tagline">WhatsApp Baileys Bot Hosting</div>
    <div class="card" id="applyCard">
      <div class="card-title">Apply for Panel Access</div>
      <div class="info">
        <strong>What you get:</strong> 2 pre-configured Node.js 24 servers ready for WhatsApp Baileys bots. Servers are created instantly after registration.
      </div>
      <div class="error" id="errorBox"></div>
      <form id="applyForm">
        <div class="form-row">
          <div class="form-group"><label>First Name</label><input type="text" name="first_name" placeholder="John" required /></div>
          <div class="form-group"><label>Last Name</label><input type="text" name="last_name" placeholder="Doe" required /></div>
        </div>
        <div class="form-group"><label>Username</label><input type="text" name="username" placeholder="johndoe" pattern="[a-zA-Z0-9_.-]+" required /></div>
        <div class="form-group"><label>Email</label><input type="email" name="email" placeholder="john@example.com" required /></div>
        <div class="form-group"><label>Password (min 8 chars)</label><input type="password" name="password" placeholder="********" minlength="8" required /></div>
        <div class="progress" id="progress">
          <div class="progress-step" id="step1"><span class="dot"></span> Creating your account...</div>
          <div class="progress-step" id="step2"><span class="dot"></span> Allocating server ports...</div>
          <div class="progress-step" id="step3"><span class="dot"></span> Creating 2 bot servers...</div>
          <div class="progress-step" id="step4"><span class="dot"></span> Installing bot template...</div>
          <div class="progress-step" id="step5"><span class="dot"></span> Finalizing your panel...</div>
        </div>
        <button type="submit" class="btn" id="submitBtn">Apply Now</button>
      </form>
      <div class="legion-auth-section">
        <div class="divider"><span>OR</span></div>
        <a href="/legion-auth" class="legion-auth-btn">Connect with Death Legion</a>
        <p>Already have a Death Legion ID? Connect and get instant access.</p>
      </div>
    </div>
    <div class="card success" id="successCard">
      <div class="check">&#10003;</div>
      <h2>Welcome to Death Legion!</h2>
      <p>Your account is ready! 2 bot servers have been created for you. You can login now.</p>
      <div class="credentials" id="credentials"></div>
      <a href="/" class="login-link">Go to Panel Login</a>
    </div>
    <div class="card heavy-load" id="heavyLoadCard">
      <div class="icon">&#9888;</div>
      <h2>We're Under Heavy Load</h2>
      <p>Our servers are experiencing high traffic right now.<br>Your request is being queued. Please wait a moment...</p>
      <div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto 1rem;display:block"></div>
      <p style="font-size:0.85rem;color:#666" id="loadCountdown">Retrying in 10 seconds...</p>
    </div>
  </div>
  <script>
    const form = document.getElementById('applyForm');
    const errorBox = document.getElementById('errorBox');
    const progress = document.getElementById('progress');
    const submitBtn = document.getElementById('submitBtn');
    const applyCard = document.getElementById('applyCard');
    const successCard = document.getElementById('successCard');
    const credentials = document.getElementById('credentials');
    const steps = [document.getElementById('step1'),document.getElementById('step2'),document.getElementById('step3'),document.getElementById('step4'),document.getElementById('step5')];
    function setStep(idx) { steps.forEach((s,i) => { s.classList.remove('active','done'); if(i<idx) s.classList.add('done'); else if(i===idx) s.classList.add('active'); }); }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span>Processing...';
      progress.style.display = 'block';
      setStep(0);
      const data = { first_name: form.first_name.value, last_name: form.last_name.value, username: form.username.value, email: form.email.value, password: form.password.value };
      const stepTimer = setInterval(() => { for(let i=0;i<steps.length;i++){ if(steps[i].classList.contains('active')){ if(i<steps.length-1) setStep(i+1); break; } } }, 2000);
      try {
        const resp = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        
        // Handle heavy load (503, 429, or timeout)
        if (resp.status === 503 || resp.status === 429 || resp.status === 504) {
          clearInterval(stepTimer);
          progress.style.display = 'none';
          applyCard.style.display = 'none';
          document.getElementById('heavyLoadCard').style.display = 'block';
          
          // Countdown + auto-retry
          let cd = 10;
          const cdEl = document.getElementById('loadCountdown');
          const cdTimer = setInterval(() => {
            cd--;
            if (cd <= 0) {
              clearInterval(cdTimer);
              cdEl.textContent = 'Retrying now...';
              setTimeout(() => window.location.reload(), 500);
            } else {
              cdEl.textContent = 'Retrying in ' + cd + ' seconds...';
            }
          }, 1000);
          return;
        }
        
        const result = await resp.json();
        clearInterval(stepTimer);
        steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
        if (result.success) {
          setTimeout(() => {
            applyCard.style.display = 'none';
            successCard.style.display = 'block';
            credentials.innerHTML = '<div><span>Username:</span><span>'+result.user.username+'</span></div><div><span>Password:</span><span>'+result.login.password+'</span></div><div><span>Servers:</span><span>'+result.servers.length+' bots created</span></div><div><span>Status:</span><span style="color:#22c55e">Ready to login!</span></div>';
          }, 500);
        } else { throw new Error(result.error || 'Failed'); }
      } catch (err) {
        clearInterval(stepTimer);
        progress.style.display = 'none';
        // Check if it's a "user already exists" type error (not a timeout)
        if (err.message && err.message.includes('already exists')) {
          errorBox.textContent = err.message;
          errorBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apply Now';
        } else {
          // Network error or timeout - show heavy load
          applyCard.style.display = 'none';
          document.getElementById('heavyLoadCard').style.display = 'block';
          let cd = 10;
          const cdEl = document.getElementById('loadCountdown');
          const cdTimer = setInterval(() => {
            cd--;
            if (cd <= 0) {
              clearInterval(cdTimer);
              cdEl.textContent = 'Retrying now...';
              setTimeout(() => window.location.reload(), 500);
            } else {
              cdEl.textContent = 'Retrying in ' + cd + ' seconds...';
            }
          }, 1000);
        }
      }
    });
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(APPLY_PAGE_HTML);
}
