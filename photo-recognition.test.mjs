import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStaffPhotoQuality, buildEvidenceManifest, decideEvidenceEmission, reconcileIndependentReadings, removePaperBackground, removeSmallDarkComponents, runRecognitionDevelopmentPipeline, verifyPhotoEvidence } from './photo-recognition.mjs';

const image = { width: 2048, height: 2800, staffLineConfidence: .94, pageCoverage: .9, blurScore: .82, contrastScore: .8, perspectiveSkewDegrees: 2 };
const observation = (overrides = {}) => ({ id: 'a1', kind: 'note', voice: 'A', measure: 2, onset: 1, duration: .5, value: { step: 'E', alter: -1, octave: 4 }, bbox: { x: 100, y: 200, width: 14, height: 12 }, confidence: .9, source: 'omr', ...overrides });

test('photo quality rejects only page-level registration failures', () => {
  assert.equal(assessStaffPhotoQuality(image).decision, 'accept');
  assert.equal(assessStaffPhotoQuality({ ...image, blurScore: .5 }).decision, 'warning');
  assert.equal(assessStaffPhotoQuality({ ...image, croppedMusicalContent: true }).decision, 'reject');
  assert.equal(assessStaffPhotoQuality({ ...image, staffLineConfidence: .2 }).decision, 'reject');
});

test('evidence manifest rejects malformed detections without inventing replacements', () => {
  const manifest = buildEvidenceManifest({ source: 'hymn.jpg', image, observations: [observation(), observation({ id: 'bad', bbox: null })] });
  assert.equal(manifest.items.length, 1);
  assert.equal(manifest.rejected.length, 1);
  assert.equal(manifest.items[0].cropRef, null);
});

test('independent agreement increases confidence while disagreement stays visible', () => {
  const primary = observation({ confidence: .78 });
  const agreement = reconcileIndependentReadings([primary], [observation({ id: 'b1', source: 'visual-reader', confidence: .8 })]);
  assert.equal(agreement.conflicts.length, 0);
  assert.equal(agreement.evidence[0].corroboration, 'independent-agreement');
  assert.equal(agreement.evidence[0].confidence, .88);
  const disagreement = reconcileIndependentReadings([primary], [observation({ id: 'b2', source: 'visual-reader', value: { step: 'E', alter: 0, octave: 4 } })]);
  assert.equal(disagreement.conflicts[0].conflictType, 'recognizer-disagreement');
  assert.equal(disagreement.evidence[0].value.alter, -1);
});

test('inference verifies photo evidence but cannot create missing notes', () => {
  const evidence = [observation()];
  const result = verifyPhotoEvidence(evidence, [
    observation({ id: 'suggestion', source: 'inference', value: { step: 'E', alter: 0, octave: 4 }, reason: 'Harmony suggests E natural.' }),
    observation({ id: 'invented', measure: 3, onset: 2, source: 'inference' }),
  ]);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].ocrValue, 'E♭4');
  assert.equal(result.conflicts[0].inferredValue, 'E♮4');
});

test('emission is localized: clear items pass while uncertain items wait for review', () => {
  const clear = observation({ corroboration: 'independent-agreement', confidence: .93 });
  const uncertain = observation({ id: 'a2', onset: 2, corroboration: 'single-reader', confidence: .7 });
  const conflicted = observation({ id: 'a3', onset: 3, corroboration: 'independent-agreement', confidence: .92 });
  const result = decideEvidenceEmission([clear, uncertain, conflicted], [{ noteId: 'a3', resolution: null }]);
  assert.deepEqual(result.counts, { emitted: 1, review: 1, blocked: 1 });
  assert.equal(result.decision, 'partial-review');
});

test('a user decision can release an item but a deferred item remains blocked', () => {
  const confirmed = observation({ decision: 'confirmed-photo', confidence: .55 });
  const deferred = observation({ id: 'a2', decision: 'deferred', confidence: .99, corroboration: 'independent-agreement' });
  const result = decideEvidenceEmission([confirmed, deferred], [{ noteId: 'a1', resolution: null }]);
  assert.equal(result.emitted[0].emissionReason, 'confirmed-photo');
  assert.equal(result.blocked[0].emissionReason, 'deferred');
});

test('development pipeline keeps image warnings separate from local symbol review', () => {
  const result = runRecognitionDevelopmentPipeline({
    source: 'hymn-1.jpg',
    image: { ...image, blurScore: .58 },
    primary: [observation({ confidence: .86 })],
    secondary: [observation({ id: 'secondary', source: 'visual-reader', confidence: .88 })],
    inference: [observation({ id: 'inference', source: 'inference' })],
  });
  assert.equal(result.quality.decision, 'warning');
  assert.equal(result.emission.decision, 'accept');
  assert.equal(result.emission.counts.emitted, 1);
});

test('development pipeline blocks the page before recognition when registration is impossible', () => {
  const result = runRecognitionDevelopmentPipeline({ source: 'bad.jpg', image: { ...image, pageCoverage: .2 }, primary: [observation()] });
  assert.equal(result.quality.decision, 'reject');
  assert.equal(result.manifest, null);
  assert.equal(result.emission.decision, 'blocked-photo');
});

test('dust cleaner removes only compact dark components and preserves real dots and lines', () => {
  const width = 12, height = 8, rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const darken = (x, y) => { const offset = (y * width + x) * 4; rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0; };
  darken(1, 1); // one-pixel dust
  for (const [x, y] of [[4, 1], [5, 1], [4, 2], [5, 2], [4, 3], [5, 3]]) darken(x, y); // octave-sized dot
  for (let x = 1; x <= 9; x += 1) darken(x, 6); // staff fragment
  const result = removeSmallDarkComponents(rgba, width, height, { threshold: 128, maxPixels: 4, maxWidth: 3, maxHeight: 3 });
  assert.equal(result.stats.removedComponents, 1);
  assert.equal(result.stats.removedPixels, 1);
  assert.equal(result.data[(1 * width + 1) * 4], 255);
  assert.equal(result.data[(1 * width + 4) * 4], 0);
  assert.equal(result.data[(6 * width + 5) * 4], 0);
});

test('dust cleaner validates image dimensions', () => {
  assert.throws(() => removeSmallDarkComponents(new Uint8ClampedArray(8), 2, 2), /RGBA data/);
});

test('symbol detail protection preserves original antialiasing while still removing dust', () => {
  const width = 8, height = 5, rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const setGray = (x, y, value) => { const offset = (y * width + x) * 4; rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = value; };
  setGray(1, 1, 40); // isolated dust
  for (const [x, y, value] of [[4,1,35],[5,1,92],[4,2,70],[5,2,118],[4,3,45],[5,3,105]]) setGray(x, y, value); // antialiased compact symbol
  const protectedResult = removeSmallDarkComponents(rgba, width, height, { threshold: 128, maxPixels: 2, maxWidth: 2, maxHeight: 2, repairGap: 0 });
  assert.equal(protectedResult.data[(1 * width + 1) * 4], 255);
  assert.equal(protectedResult.data[(1 * width + 5) * 4], 92);
  assert.equal(protectedResult.stats.preservedOriginalDetail, true);
  const binaryResult = removeSmallDarkComponents(rgba, width, height, { threshold: 128, maxPixels: 2, maxWidth: 2, maxHeight: 2, repairGap: 0, preserveSymbolDetail: false });
  assert.equal(binaryResult.data[(1 * width + 5) * 4], 0);
});

test('paper background removal whitens uneven illumination while retaining dark notation', () => {
  const width=40,height=30,rgba=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1) for(let x=0;x<width;x+=1) {
    const offset=(y*width+x)*4, paper=170+Math.round(50*x/(width-1));
    rgba[offset]=rgba[offset+1]=rgba[offset+2]=paper; rgba[offset+3]=255;
  }
  for(let y=8;y<=21;y+=1) for(let x=18;x<=21;x+=1) { const offset=(y*width+x)*4; rgba[offset]=rgba[offset+1]=rgba[offset+2]=30; }
  const result=removePaperBackground(rgba,width,height,{illuminationRadius:8,foregroundRadius:8,foregroundOffset:15});
  assert.equal(result.data[(2*width+2)*4],255);
  assert.ok(result.data[(14*width+19)*4]<100);
  assert.ok(result.stats.foregroundPixels>=40);
});

test('dust cleaner reconnects short staff-line and stem gaps before removing specks', () => {
  const width = 12, height = 9, rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const darken = (x, y) => { const offset = (y * width + x) * 4; rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0; };
  for (const x of [1, 2, 3, 5, 6, 7, 8, 9]) darken(x, 3); // one-pixel staff gap at x=4
  for (const y of [0, 1, 2, 4, 5, 6]) darken(10, y); // one-pixel stem gap at y=3
  darken(0, 8); // dust
  const result = removeSmallDarkComponents(rgba, width, height, { maxPixels: 2, maxWidth: 2, maxHeight: 2, repairGap: 2, repairSupport: 1 });
  assert.equal(result.data[(3 * width + 4) * 4], 0);
  assert.equal(result.data[(3 * width + 10) * 4], 0);
  assert.equal(result.addedMask[3 * width + 4], 1);
  assert.equal(result.addedMask[3 * width + 10], 2);
  assert.equal(result.data[(8 * width) * 4], 255);
  assert.equal(result.stats.repairedPixels, 2);
});

test('line recognizer reconstructs shallow sloped beam gaps without joining unsupported dots', () => {
  const width = 24, height = 12, rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const darken = (x, y) => { const offset = (y * width + x) * 4; rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0; };
  // A 2:1 sloped beam with a missing sample at (10, 6).
  for (const [x, y] of [[2,2],[4,3],[6,4],[8,5],[12,7],[14,8],[16,9],[18,10]]) darken(x, y);
  darken(1, 10); darken(4, 10); // two unsupported dust points
  const result = removeSmallDarkComponents(rgba, width, height, { maxPixels: 1, maxWidth: 1, maxHeight: 1, repairGap: 5, repairSupport: 2 });
  assert.equal(result.data[(6 * width + 10) * 4], 0);
  assert.ok(result.stats.repairedByDirection.diagonal > 0);
  assert.equal(result.data[(10 * width + 1) * 4], 255);
  assert.equal(result.data[(10 * width + 4) * 4], 255);
});

test('line recognizer reconstructs thin measure lines and thick system-opening lines', () => {
  const width = 14, height = 16, rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const darken = (x, y) => { const offset = (y * width + x) * 4; rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 0; };
  for (const x of [2, 3, 4]) for (const y of [1,2,3,4,5,9,10,11,12,13,14]) darken(x, y); // thick opening line, 3-pixel break
  for (const y of [1,2,3,4,5,7,8,9,10,11,12,13,14]) darken(10, y); // thin measure line, 1-pixel break
  const result = removeSmallDarkComponents(rgba, width, height, { maxPixels: 2, maxWidth: 2, maxHeight: 2, repairGap: 6, repairSupport: 3 });
  for (const x of [2, 3, 4]) for (const y of [6, 7, 8]) assert.equal(result.data[(y * width + x) * 4], 0);
  assert.equal(result.data[(6 * width + 10) * 4], 0);
  assert.ok(result.stats.repairedByDirection.vertical >= 10);
});
