// Theme toggle logic
function setTheme(theme) {
  document.body.className = theme;
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '🌙' : '☀️';
}

// Check system preference on load
window.addEventListener('DOMContentLoaded', () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const defaultTheme = prefersDark ? 'dark' : 'light';
  setTheme(defaultTheme);
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
});

document.getElementById('generateBtn').addEventListener('click', generateCover);

async function generateCover() {
    const file = document.getElementById('audioUpload').files[0];
    const albumName = document.getElementById('albumName').value;
    const colorMode = document.getElementById('colorMode').value;
    const status = document.getElementById('status');
    
    status.textContent = '';
    
    if (!file) {
        status.textContent = "Please upload an audio file!";
        return;
    }

    try {
        status.textContent = "Processing audio...";
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        
        // Try decoding with error fallback
        let audioBuffer;
        try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (decodeError) {
        console.log("Standard decode failed, trying Opus workaround...");
        // If standard decode fails, try with Opus (some browsers need this)
        audioBuffer = await decodeOpusFallback(arrayBuffer, audioContext);
        }
        
        status.textContent = "Generating cover...";
        renderRadialWaveform(audioBuffer, albumName, colorMode);
        status.textContent = "Done! Click Download Cover below.";
    } catch (error) {
        console.error("Error:", error);
        status.textContent = `Error: ${error.message}. Try a different file format.`;
    }
    }

    // Opus fallback decoder
    async function decodeOpusFallback(arrayBuffer, audioContext) {
    // Create a temporary URL for the blob
    const blob = new Blob([arrayBuffer], { type: 'audio/ogg' });
    const url = URL.createObjectURL(blob);
    
    // Create audio element to decode
    const audioElement = new Audio();
    audioElement.src = url;
    
    // Use Web Audio API to process the audio element
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(audioContext.destination);
    
    // Wait for audio to load
    await new Promise((resolve, reject) => {
        audioElement.oncanplaythrough = resolve;
        audioElement.onerror = reject;
        audioElement.load();
    });
    
    // Create offline context to render
    const offlineContext = new OfflineAudioContext(
        2, // Stereo
        audioElement.duration * 44100, // Samples
        44100 // Sample rate
    );
    
    const offlineSource = offlineContext.createMediaElementSource(audioElement);
    offlineSource.connect(offlineContext.destination);
    
    audioElement.play();
    const renderedBuffer = await offlineContext.startRendering();
    URL.revokeObjectURL(url);
    
    return renderedBuffer;
    }

function renderRadialWaveform(audioBuffer, albumName, colorMode) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  canvas.style.display = 'block';
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Generate guaranteed gradient background
  function getRandomHue() { return Math.floor(Math.random() * 360); }
  
  let saturation, lightness;
  if (colorMode === 'light') {
    saturation = 70;
    lightness = [60, 80]; // Bright colors
  } else {
    saturation = 70;
    lightness = [20, 40]; // Dark colors
  }
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `hsl(${getRandomHue()}, ${saturation}%, ${lightness[0]}%)`);
  gradient.addColorStop(1, `hsl(${getRandomHue()}, ${saturation}%, ${lightness[1]}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw clean central circle
  ctx.beginPath();
  ctx.arc(canvas.width/2, canvas.height/2, canvas.width*0.25, 0, Math.PI*2);
  ctx.fillStyle = colorMode === 'light' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
  ctx.fill();

  // Process audio data
  const data = audioBuffer.getChannelData(0);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const innerRadius = canvas.width * 0.1;  // Smaller center circle (was 0.3)
  const maxRadius = canvas.width * 0.43;    // Slightly shorter bars (was 0.45)

  // Find max amplitude
  let maxAmplitude = 0.01;
  for (let i = 0; i < data.length; i++) {
    maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
  }

  // Draw waveform bars (all outward)
  ctx.strokeStyle = colorMode === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 5;
  const barWidth = (2 * Math.PI) / 200;
  
  for (let i = 0; i < 200; i++) {
    const index = Math.floor(i * data.length / 200);
    const amplitude = Math.abs(data[index]) / maxAmplitude;
    const barLength = amplitude * (maxRadius - innerRadius);
    const angle = (i / 200) * 2 * Math.PI;
    
    // Draw each bar
    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(angle) * innerRadius,
      centerY + Math.sin(angle) * innerRadius
    );
    ctx.lineTo(
      centerX + Math.cos(angle) * (innerRadius + barLength),
      centerY + Math.sin(angle) * (innerRadius + barLength)
    );
    ctx.stroke();
  }

  // Add album name
  if (albumName) {
    ctx.fillStyle = colorMode === 'light' ? '#111' : '#fff';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(albumName.toUpperCase(), centerX, canvas.height - 50);
  }

  // Enable download
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.href = canvas.toDataURL('image/png');
  downloadBtn.style.display = 'block';
}
