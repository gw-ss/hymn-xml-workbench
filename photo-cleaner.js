import { removePaperBackground, removeSmallDarkComponents } from './photo-recognition.mjs';

const fileInput = document.querySelector('#photo-file');
const protectSymbols = document.querySelector('#protect-symbols');
const removeBackground = document.querySelector('#remove-background');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const downloadOriginal = document.querySelector('#download-original');
const rotateLeft = document.querySelector('#rotate-left');
const rotateRight = document.querySelector('#rotate-right');
const resetRotation = document.querySelector('#reset-rotation');
const rotationValue = document.querySelector('#rotation-value');
const toggleEraser = document.querySelector('#toggle-eraser');
const eraserSize = document.querySelector('#eraser-size');
const eraserShape = document.querySelector('#eraser-shape');
const undoEraser = document.querySelector('#undo-eraser');
const canvasFrame = document.querySelector('.canvas-frame');
const eraserCursor = document.querySelector('#eraser-cursor');
const canvas = document.querySelector('#preview');
const context = canvas.getContext('2d', { willReadFrequently: true });

let rawSource = null, source = null, result = null, filename = 'cleaned-hymn-photo.png', originalFilename = 'straightened-hymn-photo.png', rotationDegrees = 0, eraserActive = false, erasing = false, currentErase = null, eraseHistory = [];

const previewMode = () => document.querySelector('input[name="preview"]:checked').value;

function drawPreview() {
  if (!source || !result) return;
  const mode = previewMode();
  if (mode === 'original') context.putImageData(source, 0, 0);
  else if (mode === 'cleaned') context.putImageData(new ImageData(result.data, source.width, source.height), 0, 0);
  else context.putImageData(source, 0, 0);
}

function processPhoto() {
  if (!source) return;
  status.textContent = 'Processing…';
  requestAnimationFrame(() => {
    const backgroundResult = removeBackground.checked ? removePaperBackground(source.data, source.width, source.height) : { data: source.data, stats: null };
    result = removeSmallDarkComponents(backgroundResult.data, source.width, source.height, {
      threshold: 128,
      maxPixels: 4,
      maxWidth: 3,
      maxHeight: 3,
      repairGap: 0,
      preserveSymbolDetail: protectSymbols.checked,
    });
    result.backgroundStats = backgroundResult.stats;
    drawPreview();
    const { removedComponents, removedPixels } = result.stats;
    const backgroundText = result.backgroundStats ? `Removed the uneven paper background while retaining ${result.backgroundStats.foregroundPixels.toLocaleString()} recognized ink pixels; ` : 'Kept the original paper background; ';
    status.textContent = `${backgroundText}removed ${removedComponents.toLocaleString()} dust components (${removedPixels.toLocaleString()} pixels) without redrawing music geometry.`;
    download.disabled = downloadOriginal.disabled = false;
  });
}

function processSettledSetting() {
  download.disabled = downloadOriginal.disabled = true;
  processPhoto();
}

function applyRotation() {
  if (!rawSource) return;
  download.disabled=downloadOriginal.disabled=true;
  const radians=rotationDegrees*Math.PI/180, cosine=Math.abs(Math.cos(radians)), sine=Math.abs(Math.sin(radians));
  const width=Math.ceil(rawSource.width*cosine+rawSource.height*sine), height=Math.ceil(rawSource.width*sine+rawSource.height*cosine);
  const rawCanvas=document.createElement('canvas'); rawCanvas.width=rawSource.width; rawCanvas.height=rawSource.height; rawCanvas.getContext('2d').putImageData(rawSource,0,0);
  if (rotationDegrees===0) { canvas.width=rawSource.width; canvas.height=rawSource.height; context.putImageData(rawSource,0,0); source=context.getImageData(0,0,canvas.width,canvas.height); }
  else {
    const rotatedCanvas=document.createElement('canvas'); rotatedCanvas.width=width; rotatedCanvas.height=height; const rotatedContext=rotatedCanvas.getContext('2d');
    rotatedContext.fillStyle='white'; rotatedContext.fillRect(0,0,width,height); rotatedContext.translate(width/2,height/2); rotatedContext.rotate(radians); rotatedContext.drawImage(rawCanvas,-rawSource.width/2,-rawSource.height/2);
    canvas.width=width; canvas.height=height; context.drawImage(rotatedCanvas,0,0);
    source=context.getImageData(0,0,canvas.width,canvas.height);
  }
  eraseHistory=[]; undoEraser.disabled=true; rotationValue.value=`${rotationDegrees.toFixed(1)}°`; processSettledSetting();
}

function changeRotation(delta) { rotationDegrees=Math.round(Math.max(-45,Math.min(45,rotationDegrees+delta))*10)/10; applyRotation(); }

async function loadPhoto(file) {
  status.textContent = `Loading ${file.name}…`;
  try {
    const bitmap = await createImageBitmap(file);
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    rawSource = context.getImageData(0, 0, canvas.width, canvas.height); source=rawSource; rotationDegrees=0; rotationValue.value='0.0°'; eraseHistory=[]; rotateLeft.disabled=rotateRight.disabled=resetRotation.disabled=toggleEraser.disabled=eraserSize.disabled=eraserShape.disabled=false;
    filename = `${file.name.replace(/\.[^.]+$/, '')}-cleaned.png`;
    originalFilename = `${file.name.replace(/\.[^.]+$/, '')}-straightened.png`;
    processPhoto();
  } catch (error) {
    rawSource = source = result = null; download.disabled = downloadOriginal.disabled = rotateLeft.disabled = rotateRight.disabled = resetRotation.disabled = toggleEraser.disabled = eraserSize.disabled = eraserShape.disabled = undoEraser.disabled = true;
    status.textContent = 'This browser could not decode that file. Open it in Preview, choose File → Export, save a PNG, and load the PNG here.';
    console.error(error);
  }
}

fileInput.addEventListener('change', () => { const [file] = fileInput.files; if (file) loadPhoto(file); });
protectSymbols.addEventListener('change', processSettledSetting);
removeBackground.addEventListener('change', processSettledSetting);
rotateLeft.addEventListener('click',()=>changeRotation(-.2));
rotateRight.addEventListener('click',()=>changeRotation(.2));
resetRotation.addEventListener('click',()=>{ rotationDegrees=0; applyRotation(); });
toggleEraser.addEventListener('click',()=>{
  eraserActive=!eraserActive; toggleEraser.setAttribute('aria-pressed',String(eraserActive)); toggleEraser.textContent=eraserActive?'Eraser on':'Eraser off'; canvasFrame.classList.toggle('eraser-active',eraserActive);
  if(!eraserActive){ erasing=false; currentErase=null; eraserCursor.classList.add('hidden'); canvas.style.cursor='default'; }
  else canvas.style.removeProperty('cursor');
});

function updateEraserCursor(event) {
  if(!eraserActive||!source){ eraserCursor.classList.add('hidden'); return; }
  const rect=canvas.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){ if(!erasing)eraserCursor.classList.add('hidden'); return; }
  const displayedSize=Math.max(6,Number(eraserSize.value)*rect.width/canvas.width);
  eraserCursor.style.width=`${displayedSize}px`; eraserCursor.style.height=`${displayedSize}px`; eraserCursor.style.left=`${event.clientX}px`; eraserCursor.style.top=`${event.clientY}px`;
  eraserCursor.classList.toggle('square',eraserShape.value==='square'); eraserCursor.classList.remove('hidden');
}

function eraseAt(event) {
  if(!eraserActive||!source)return;
  const rect=canvas.getBoundingClientRect(),x=Math.round((event.clientX-rect.left)*canvas.width/rect.width),y=Math.round((event.clientY-rect.top)*canvas.height/rect.height),radius=Number(eraserSize.value)/2;
  for(let py=Math.max(0,Math.floor(y-radius));py<=Math.min(source.height-1,Math.ceil(y+radius));py+=1) for(let px=Math.max(0,Math.floor(x-radius));px<=Math.min(source.width-1,Math.ceil(x+radius));px+=1) {
    if(eraserShape.value==='circle'&&(px-x)**2+(py-y)**2>radius**2)continue;
    const index=py*source.width+px,offset=index*4;
    if(!currentErase.has(index))currentErase.set(index,{ source:[source.data[offset],source.data[offset+1],source.data[offset+2],source.data[offset+3]], cleaned:result?[result.data[offset],result.data[offset+1],result.data[offset+2],result.data[offset+3]]:null });
    source.data[offset]=source.data[offset+1]=source.data[offset+2]=255; source.data[offset+3]=255;
    if(result){ result.data[offset]=result.data[offset+1]=result.data[offset+2]=255; result.data[offset+3]=255; }
  }
  context.save(); context.fillStyle='white'; if(eraserShape.value==='circle'){ context.beginPath(); context.arc(x,y,radius,0,Math.PI*2); context.fill(); } else context.fillRect(x-radius,y-radius,radius*2,radius*2); context.restore();
}
canvas.addEventListener('pointerdown',event=>{ if(!eraserActive||!source)return; event.preventDefault(); erasing=true; currentErase=new Map(); canvas.setPointerCapture(event.pointerId); eraseAt(event); });
canvas.addEventListener('pointermove',event=>{ updateEraserCursor(event); if(erasing)eraseAt(event); });
canvas.addEventListener('pointerenter',updateEraserCursor);
canvas.addEventListener('pointerleave',()=>{ if(!erasing)eraserCursor.classList.add('hidden'); });
canvas.addEventListener('pointerup',event=>{ if(!erasing)return; erasing=false; canvas.releasePointerCapture(event.pointerId); if(currentErase?.size){ eraseHistory.push(currentErase); if(eraseHistory.length>20)eraseHistory.shift(); undoEraser.disabled=false; status.textContent=`Applied a stable ${eraserShape.value} eraser stroke without recalculating the page background.`; } currentErase=null; drawPreview(); download.disabled=downloadOriginal.disabled=false; });
canvas.addEventListener('pointercancel',()=>{ erasing=false; currentErase=null; drawPreview(); });
undoEraser.addEventListener('click',()=>{ const stroke=eraseHistory.pop(); if(!stroke||!source)return; for(const [index,colors] of stroke){ const offset=index*4,color=colors.source; source.data[offset]=color[0];source.data[offset+1]=color[1];source.data[offset+2]=color[2];source.data[offset+3]=color[3]; if(result&&colors.cleaned){ const cleaned=colors.cleaned;result.data[offset]=cleaned[0];result.data[offset+1]=cleaned[1];result.data[offset+2]=cleaned[2];result.data[offset+3]=cleaned[3]; } } undoEraser.disabled=!eraseHistory.length; drawPreview(); status.textContent='Undid the most recent eraser stroke without recalculating the page background.'; });
eraserShape.addEventListener('change',()=>eraserCursor.classList.toggle('square',eraserShape.value==='square'));
document.querySelectorAll('input[name="preview"]').forEach(control => control.addEventListener('change', drawPreview));
async function savePng(imageData, suggestedName) {
  download.disabled = downloadOriginal.disabled = true;
  canvas.width=imageData.width; canvas.height=imageData.height; context.putImageData(imageData,0,0);
  try {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        startIn: 'downloads',
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      status.textContent = `Saved ${handle.name}. The original photo was not changed.`;
    } else {
      const link = document.createElement('a');
      link.download = suggestedName; link.href = URL.createObjectURL(blob); link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      status.textContent = `Saved ${suggestedName} to the browser's Downloads location. This browser cannot show a Save chooser for local pages.`;
    }
  } catch (error) {
    if (error?.name !== 'AbortError') { status.textContent = `The cleaned PNG could not be saved: ${error.message}`; console.error(error); }
    else status.textContent = 'Save canceled; no file was created.';
  } finally {
    drawPreview(); download.disabled = downloadOriginal.disabled = false;
  }
}

download.addEventListener('click',()=>{ if(result) savePng(new ImageData(result.data,source.width,source.height),filename); });
downloadOriginal.addEventListener('click',()=>{ if(source) savePng(source,originalFilename); });
