const canvas = document.querySelector('.lorenz-canvas');
const context = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const smallScreen = window.matchMedia('(max-width: 700px)');
const trajectory = [];
const stars = [];
const colors = {
  ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
  muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()
};

let x = 0.1;
let y = 0;
let z = 0;

for (let index = 0; index < 18000; index += 1) {
  const dx = 10 * (y - x) * 0.005;
  const dy = (x * (28 - z) - y) * 0.005;
  const dz = (x * y - (8 / 3) * z) * 0.005;
  x += dx;
  y += dy;
  z += dz;

  if (index > 800 && index % 3 === 0) {
    trajectory.push({ x, y, z });
  }
}

const particleCount = 9;
const particleSpacing = trajectory.length / particleCount;
const rotation = { yaw: 0.45, pitch: 0.45 };
const targetRotation = { yaw: 0.45, pitch: 0.45 };
const rotationVelocity = { yaw: 0, pitch: 0 };
const autoRotationSpeed = 0.0001;
let dragStart = null;
let isDragging = false;
let previousTime = 0;

let seed = 17;
for (let index = 0; index < 90; index += 1) {
  seed = (seed * 9301 + 49297) % 233280;
  stars.push({
    x: (seed / 233280) * 2 - 1,
    y: ((seed * 1.7) % 233280) / 233280 * 2 - 1,
    depth: 0.25 + ((seed * 2.3) % 233280) / 233280 * 0.75
  });
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = bounds.width * ratio;
  canvas.height = bounds.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function project(point, yaw, pitch, width, height) {
  const normalizedX = point.x / 24;
  const normalizedY = (point.z - 24) / 28;
  const normalizedZ = point.y / 34;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const rotatedX = normalizedX * cosYaw - normalizedZ * sinYaw;
  const rotatedZ = normalizedX * sinYaw + normalizedZ * cosYaw;
  const projectedY = normalizedY * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
  const depth = normalizedY * Math.sin(pitch) + rotatedZ * Math.cos(pitch);
  const perspective = 1 / (1 + depth * 0.18);

  return {
    x: width / 2 + rotatedX * width * 0.34 * perspective,
    y: height / 2 - projectedY * height * 0.34 * perspective,
    depth
  };
}

function draw(time) {
  if (smallScreen.matches) {
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const elapsed = previousTime ? time - previousTime : 0;
  previousTime = time;

  if (!isDragging) {
    targetRotation.yaw += elapsed * autoRotationSpeed;
    targetRotation.yaw += rotationVelocity.yaw;
    targetRotation.pitch = Math.max(-1.5, Math.min(1.5, targetRotation.pitch + rotationVelocity.pitch));
    rotationVelocity.yaw *= 0.94;
    rotationVelocity.pitch *= 0.94;
  }

  rotation.yaw += (targetRotation.yaw - rotation.yaw) * 0.12;
  rotation.pitch += (targetRotation.pitch - rotation.pitch) * 0.12;

  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.muted;
  stars.forEach(star => {
    context.globalAlpha = star.depth * 0.24;
    context.fillRect(width / 2 + star.x * width * 0.5, height / 2 + star.y * height * 0.5, 1, 1);
  });

  context.beginPath();
  trajectory.forEach((point, index) => {
    const projected = project(point, rotation.yaw, rotation.pitch, width, height);
    if (index === 0) {
      context.moveTo(projected.x, projected.y);
    } else {
      context.lineTo(projected.x, projected.y);
    }
  });
  context.globalAlpha = 0.26;
  context.strokeStyle = colors.ink;
  context.lineWidth = 0.7;
  context.stroke();

  context.fillStyle = colors.ink;
  trajectory.forEach((point, index) => {
    if (index % 24 !== 0) return;
    const projected = project(point, rotation.yaw, rotation.pitch, width, height);
    context.globalAlpha = 0.1 + (1 - Math.min(1, Math.abs(projected.depth))) * 0.14;
    context.fillRect(projected.x, projected.y, 1.1, 1.1);
  });

  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const progress = reducedMotion.matches
      ? particleIndex * particleSpacing
      : (time * 0.035 + particleIndex * particleSpacing) % trajectory.length;

    for (let trailIndex = 7; trailIndex >= 0; trailIndex -= 1) {
      const pointIndex = Math.floor((progress - trailIndex * 3 + trajectory.length) % trajectory.length);
      const projected = project(trajectory[pointIndex], rotation.yaw, rotation.pitch, width, height);
      context.globalAlpha = (8 - trailIndex) * 0.035;
      context.beginPath();
      context.arc(projected.x, projected.y, trailIndex === 0 ? 2 : 1.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.globalAlpha = 1;
  window.requestAnimationFrame(draw);
}

canvas.addEventListener('pointerdown', event => {
  if (smallScreen.matches) return;
  dragStart = { x: event.clientX, y: event.clientY };
  isDragging = true;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('is-dragging');
});

canvas.addEventListener('pointermove', event => {
  if (!dragStart) return;
  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  targetRotation.yaw += deltaX * 0.008;
  targetRotation.pitch = Math.max(-1.5, Math.min(1.5, targetRotation.pitch + deltaY * 0.008));
  rotationVelocity.yaw = deltaX * 0.0015;
  rotationVelocity.pitch = deltaY * 0.0015;
  dragStart = { x: event.clientX, y: event.clientY };
});

function stopDragging(event) {
  if (dragStart && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  dragStart = null;
  isDragging = false;
  canvas.classList.remove('is-dragging');
}

canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);

window.addEventListener('resize', resizeCanvas);
smallScreen.addEventListener('change', () => {
  resizeCanvas();
  if (!smallScreen.matches) draw(performance.now());
});
resizeCanvas();
if (!smallScreen.matches) draw(0);
