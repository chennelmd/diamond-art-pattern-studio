const canvas = document.querySelector('#gemCanvas');
const ctx = canvas.getContext('2d');
const colors = ['#76529d', '#8d68b1', '#aa85c5', '#c4a4d8', '#e0c7eb', '#f0ddf6'];

function drawGem() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = 13;
  const pattern = [
    '0000000000111111110000000000',
    '0000000111223333221110000000',
    '0000011223445555443221100000',
    '0001123455555555555432110000',
    '0011234555555555555543211000',
    '0112345555555555555554321100',
    '1123455555555555555555432110',
    '1234555555555555555555543211',
    '0123455555555555555555432100',
    '0012345555555555555554321000',
    '0001234555555555555543210000',
    '0000123455555555555432100000',
    '0000012345555555554321000000',
    '0000001234555555543210000000',
    '0000000123455555432100000000',
    '0000000012345554321000000000',
    '0000000001234543210000000000',
    '0000000000123432100000000000',
  ];
  const offsetX = 95, offsetY = 18;
  pattern.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '0') return;
    const px = offsetX + x * size, py = offsetY + y * size;
    ctx.fillStyle = colors[Number(value)];
    ctx.beginPath();
    ctx.moveTo(px + size / 2, py); ctx.lineTo(px + size, py + size / 2);
    ctx.lineTo(px + size / 2, py + size); ctx.lineTo(px, py + size / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.stroke();
  }));
}

drawGem();

const dialog = document.querySelector('#projectDialog');
const input = document.querySelector('#artwork');
const continueBtn = document.querySelector('#continueBtn');
document.querySelector('#startProject').addEventListener('click', () => dialog.showModal());
document.querySelector('.new-project').addEventListener('click', () => dialog.showModal());
input.addEventListener('change', () => {
  const file = input.files[0];
  document.querySelector('#fileName').textContent = file ? `✓ ${file.name} selected` : '';
  continueBtn.disabled = !file;
});
continueBtn.addEventListener('click', (event) => {
  if (!input.files.length) event.preventDefault();
});

document.querySelectorAll('.project-card').forEach(card => card.addEventListener('click', () => {
  card.animate([{ transform: 'translateY(-3px)' }, { transform: 'translateY(-3px) scale(.99)' }, { transform: 'translateY(-3px)' }], { duration: 240 });
}));
