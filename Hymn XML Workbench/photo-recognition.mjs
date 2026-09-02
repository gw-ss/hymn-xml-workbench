const VOICES = new Set(['S', 'A', 'T', 'B']);
const SYMBOL_KINDS = new Set(['note', 'rest', 'accidental', 'stem', 'beam', 'barline', 'clef', 'key-signature', 'time-signature', 'tie', 'slur']);
const DECISIONS = new Set(['confirmed-photo', 'corrected', 'deferred']);

const finite = value => Number.isFinite(Number(value));
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const evidenceLabel = value => {
  if (value === null || value === undefined || value === '') return 'Unclear';
  if (typeof value !== 'object') return String(value);
  if (value.step && finite(value.octave)) {
    const accidental = Number(value.alter) === -1 ? '♭' : Number(value.alter) === 1 ? '♯' : Number(value.alter) === 0 ? '♮' : '';
    return `${value.step}${accidental}${value.octave}`;
  }
  return JSON.stringify(value);
};

function localMean(values, width, height, radius) {
  const stride = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += values[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius), y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius), x2 = Math.min(width - 1, x + radius);
      const sum = integral[(y2 + 1) * stride + x2 + 1] - integral[y1 * stride + x2 + 1] - integral[(y2 + 1) * stride + x1] + integral[y1 * stride + x1];
      output[y * width + x] = sum / ((x2 - x1 + 1) * (y2 - y1 + 1));
    }
  }
  return output;
}

export function removePaperBackground(rgba, width, height, { illuminationRadius = 55, foregroundRadius = 50, foregroundOffset = 19, minimumComponentArea = 5 } = {}) {
  const pixels = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba || []);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || pixels.length !== width * height * 4) throw new Error('RGBA data must match the positive image dimensions.');
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    gray[index] = Math.round(.2126 * pixels[offset] + .7152 * pixels[offset + 1] + .0722 * pixels[offset + 2]);
  }
  const background = localMean(gray, width, height, Math.max(8, Math.round(illuminationRadius)));
  const normalized = new Uint8Array(gray.length);
  for (let index = 0; index < gray.length; index += 1) normalized[index] = Math.max(0, Math.min(255, Math.round(gray[index] * 245 / Math.max(1, background[index]))));
  // Match the development cleaner's conservative contrast stretch. Clipping
  // only the outer 0.25%/0.3% removes residual gray illumination without
  // choosing a global foreground threshold or flattening antialiased ink.
  const histogram = new Uint32Array(256);
  for (const value of normalized) histogram[value] += 1;
  const percentileValue = fraction => {
    const target = normalized.length * fraction;
    let cumulative = 0;
    for (let value = 0; value < histogram.length; value += 1) {
      cumulative += histogram[value];
      if (cumulative >= target) return value;
    }
    return 255;
  };
  const low = percentileValue(.0025), high = percentileValue(.997);
  const span = Math.max(1, high - low);
  for (let index = 0; index < normalized.length; index += 1) normalized[index] = Math.max(0, Math.min(255, Math.round((normalized[index] - low) * 255 / span)));
  const neighborhood = localMean(normalized, width, height, Math.max(8, Math.round(foregroundRadius)));
  const foreground = new Uint8Array(gray.length);
  for (let index = 0; index < foreground.length; index += 1) foreground[index] = normalized[index] < neighborhood[index] - foregroundOffset ? 1 : 0;

  const visited = new Uint8Array(foreground.length), keep = new Uint8Array(foreground.length);
  const directions = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  let keptComponents = 0, rejectedComponents = 0;
  for (let start = 0; start < foreground.length; start += 1) {
    if (!foreground[start] || visited[start]) continue;
    const stack = [start], members = []; visited[start] = 1;
    let minX = start % width, maxX = minX, minY = Math.floor(start / width), maxY = minY;
    while (stack.length) {
      const current = stack.pop(), x = current % width, y = Math.floor(current / width);
      members.push(current); minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y);
      for (const [dx,dy] of directions) {
        const nx=x+dx, ny=y+dy; if (nx<0||nx>=width||ny<0||ny>=height) continue;
        const neighbor=ny*width+nx; if (foreground[neighbor]&&!visited[neighbor]) { visited[neighbor]=1; stack.push(neighbor); }
      }
    }
    const preserve = members.length >= minimumComponentArea || maxX-minX+1 >= 4 || maxY-minY+1 >= 4;
    if (preserve) { keptComponents += 1; for (const index of members) keep[index]=1; } else rejectedComponents += 1;
  }
  const halo = new Uint8Array(keep);
  for (let y=0;y<height;y+=1) for (let x=0;x<width;x+=1) if (keep[y*width+x]) for (const [dx,dy] of directions) {
    const nx=x+dx,ny=y+dy; if(nx>=0&&nx<width&&ny>=0&&ny<height&&normalized[ny*width+nx]<210) halo[ny*width+nx]=1;
  }
  const output = new Uint8ClampedArray(pixels.length);
  for (let index=0;index<gray.length;index+=1) {
    const offset=index*4, value=halo[index]?normalized[index]:255;
    output[offset]=value; output[offset+1]=value; output[offset+2]=value; output[offset+3]=pixels[offset+3];
  }
  return { data: output, stats: { keptComponents, rejectedComponents, foregroundPixels: keep.reduce((sum,value)=>sum+value,0), contrastRange: { low, high } } };
}

function reconstructMusicStructures(dark, width, height, { maxGap = 6, support = 3 } = {}) {
  const addedMask = new Uint8Array(width * height);
  const structuralGap = Math.max(8, Math.min(24, Number(maxGap) || 0));
  const verticalMinimum = Math.max(4, Math.round(height * .022));
  const horizontalMinimum = Math.max(6, Math.round(width * .014));
  const setDark = (x, y, family) => {
    const index = y * width + x;
    if (dark[index]) return 0;
    dark[index] = 1; addedMask[index] = family;
    return 1;
  };
  const scanRuns = (length, isDark, gapLimit, minimumSpan, minimumDensity) => {
    const runs = [];
    let start = -1, lastInk = -1, ink = 0;
    const finish = () => {
      if (start < 0) return;
      const span = lastInk - start + 1;
      if (span >= minimumSpan && ink / span >= minimumDensity) runs.push({ start, end: lastInk, span, ink, density: ink / span });
      start = -1; lastInk = -1; ink = 0;
    };
    for (let position = 0; position < length; position += 1) {
      if (isDark(position)) {
        if (start < 0) start = position;
        lastInk = position; ink += 1;
      } else if (start >= 0 && position - lastInk > gapLimit) finish();
    }
    finish();
    return runs;
  };

  // Stage 1: long vertical structures establish system and measure boundaries.
  const verticalColumns = [];
  for (let x = 0; x < width; x += 1) {
    for (const run of scanRuns(height, y => dark[y * width + x], structuralGap, verticalMinimum, .48)) verticalColumns.push({ x, y1: run.start, y2: run.end, density: run.density });
  }
  const verticalStructures = [];
  for (const column of verticalColumns) {
    const previous = verticalStructures.at(-1);
    const overlap = previous ? Math.max(0, Math.min(previous.y2, column.y2) - Math.max(previous.y1, column.y1) + 1) : 0;
    const shorter = previous ? Math.min(previous.y2 - previous.y1 + 1, column.y2 - column.y1 + 1) : 1;
    if (previous && column.x <= previous.x2 + 1 && overlap / shorter >= .72) {
      previous.x2 = column.x; previous.y1 = Math.min(previous.y1, column.y1); previous.y2 = Math.max(previous.y2, column.y2);
    } else verticalStructures.push({ x1: column.x, x2: column.x, y1: column.y1, y2: column.y2 });
  }
  let verticalPixels = 0;
  for (const structure of verticalStructures) {
    structure.thickness = structure.x2 - structure.x1 + 1;
    structure.kind = structure.thickness >= 3 ? 'system-or-stop' : 'measure';
    for (let x = structure.x1; x <= structure.x2; x += 1) for (let y = structure.y1; y <= structure.y2; y += 1) verticalPixels += setDark(x, y, 2);
  }
  for (let index = 0; index < verticalStructures.length - 1; index += 1) {
    const left = verticalStructures[index], right = verticalStructures[index + 1];
    const separation = right.x1 - left.x2;
    const overlap = Math.max(0, Math.min(left.y2, right.y2) - Math.max(left.y1, right.y1) + 1);
    if (separation <= 5 && overlap >= verticalMinimum * .7) { left.kind = 'repeat-or-end'; right.kind = 'repeat-or-end'; }
  }

  // Stage 2: redraw supported horizontal structures, clamped to the vertical
  // boundaries that cover the same y position. This includes staff lines,
  // Jianpu underlines, sustain lines, and horizontal beam rows.
  const horizontalRuns = [];
  for (let y = 0; y < height; y += 1) {
    for (const run of scanRuns(width, x => dark[y * width + x], structuralGap, horizontalMinimum, .5)) horizontalRuns.push({ y, x1: run.start, x2: run.end, density: run.density });
  }
  let horizontalPixels = 0;
  for (const line of horizontalRuns) {
    const boundaries = verticalStructures.filter(item => item.y1 <= line.y && item.y2 >= line.y).map(item => ({ left: item.x1, right: item.x2 }));
    const leftBoundary = boundaries.filter(item => item.right <= line.x1 && line.x1 - item.right <= structuralGap * 2).toSorted((a, b) => b.right - a.right)[0];
    const rightBoundary = boundaries.filter(item => item.left >= line.x2 && item.left - line.x2 <= structuralGap * 2).toSorted((a, b) => a.left - b.left)[0];
    const start = leftBoundary ? leftBoundary.right : line.x1;
    const end = rightBoundary ? rightBoundary.left : line.x2;
    for (let x = start; x <= end; x += 1) horizontalPixels += setDark(x, line.y, 1);
  }

  // Stage 3: supported sloped fragments reconstruct beams and straight
  // connectors. Both sides need several original pixels, preventing dust pairs
  // from becoming new lines.
  const snapshot = new Uint8Array(dark);
  const directions = [{ dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: 2, dy: 1 }, { dx: 2, dy: -1 }, { dx: 3, dy: 1 }, { dx: 3, dy: -1 }];
  const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  const original = (x, y) => inBounds(x, y) && snapshot[y * width + x];
  const hasSupport = (x, y, dx, dy, sign) => {
    for (let step = 1; step <= support; step += 1) if (!original(x + sign * dx * step, y + sign * dy * step)) return false;
    return true;
  };
  const drawBresenham = (x0, y0, x1, y1) => {
    let added = 0, x = x0, y = y0;
    const deltaX = Math.abs(x1 - x0), stepX = x0 < x1 ? 1 : -1, deltaY = -Math.abs(y1 - y0), stepY = y0 < y1 ? 1 : -1;
    let error = deltaX + deltaY;
    while (true) {
      added += setDark(x, y, 3);
      if (x === x1 && y === y1) break;
      const twice = 2 * error;
      if (twice >= deltaY) { error += deltaY; x += stepX; }
      if (twice <= deltaX) { error += deltaX; y += stepY; }
    }
    return added;
  };
  let slopedPixels = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!original(x, y)) continue;
    for (const { dx, dy } of directions) {
      if (!hasSupport(x, y, dx, dy, -1)) continue;
      const stride = Math.max(Math.abs(dx), Math.abs(dy));
      const maxSteps = Math.max(1, Math.floor(maxGap / stride)) + 1;
      for (let distance = 2; distance <= maxSteps; distance += 1) {
        const endX = x + dx * distance, endY = y + dy * distance;
        if (!inBounds(endX, endY)) break;
        if (!original(endX, endY)) continue;
        if (hasSupport(endX, endY, dx, dy, 1)) slopedPixels += drawBresenham(x, y, endX, endY);
        break;
      }
    }
  }
  return {
    addedMask,
    stats: {
      verticalStructures: verticalStructures.length,
      measureBoundaries: verticalStructures.filter(item => item.kind === 'measure').length,
      strongBoundaries: verticalStructures.filter(item => item.kind !== 'measure').length,
      horizontalStructures: horizontalRuns.length,
      repairedByDirection: { horizontal: horizontalPixels, vertical: verticalPixels, diagonal: slopedPixels },
    },
  };
}

export function assessStaffPhotoQuality(metrics = {}) {
  const width = Number(metrics.width) || 0;
  const height = Number(metrics.height) || 0;
  const minDimension = Math.min(width, height);
  const staffLineConfidence = clamp01(metrics.staffLineConfidence);
  const pageCoverage = clamp01(metrics.pageCoverage);
  const blurScore = clamp01(metrics.blurScore);
  const contrastScore = clamp01(metrics.contrastScore);
  const skew = Math.abs(Number(metrics.perspectiveSkewDegrees) || 0);
  const croppedMusicalContent = Boolean(metrics.croppedMusicalContent);
  const reasons = [];
  const recommendations = [];

  if (minDimension < 600) reasons.push('The image resolution is too low to register staff geometry reliably.');
  if (staffLineConfidence < .45) reasons.push('The staff lines cannot be located reliably.');
  if (pageCoverage < .55) reasons.push('Too little of the musical page is visible for stable registration.');
  if (skew > 14) reasons.push('Perspective distortion is too severe for stable staff registration.');
  if (croppedMusicalContent) reasons.push('Musical content is cropped at an image edge.');
  if (reasons.length) return { decision: 'reject', reasons, recommendations: ['Retake or recrop the photograph so the complete staff systems are visible and sharp.'] };

  if (minDimension < 1000) recommendations.push('A higher-resolution image may improve accidental and beam recognition.');
  if (staffLineConfidence < .78) recommendations.push('Some staff regions need localized review.');
  if (pageCoverage < .75) recommendations.push('Registration has limited page context.');
  if (blurScore < .65) recommendations.push('Fine symbols may be blurred; review localized detections.');
  if (contrastScore < .55) recommendations.push('Low contrast may hide accidentals or thin stems.');
  if (skew > 6) recommendations.push('Perspective correction is substantial; review outer measures.');
  return { decision: recommendations.length ? 'warning' : 'accept', reasons: [], recommendations };
}

function grayscaleInkProfile(rgba, width, height, threshold) {
  const rows = new Uint32Array(height);
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const gray = .2126 * rgba[offset] + .7152 * rgba[offset + 1] + .0722 * rgba[offset + 2];
      if (gray < threshold) count += 1;
    }
    rows[y] = count;
  }
  return rows;
}

function rowLinePeaks(profile, width, { minimumCoverage = .2 } = {}) {
  const threshold = width * minimumCoverage, bands = [];
  let start = -1, weighted = 0, total = 0, maximum = 0;
  const finish = end => {
    if (start < 0) return;
    bands.push({ y: total ? weighted / total : (start + end) / 2, y1: start, y2: end, strength: maximum / width });
    start = -1; weighted = 0; total = 0; maximum = 0;
  };
  for (let y = 0; y < profile.length; y += 1) {
    const smoothed = (profile[Math.max(0, y - 1)] + profile[y] + profile[Math.min(profile.length - 1, y + 1)]) / 3;
    if (smoothed >= threshold) {
      if (start < 0) start = y;
      weighted += y * smoothed; total += smoothed; maximum = Math.max(maximum, smoothed);
    } else finish(y - 1);
  }
  finish(profile.length - 1);
  return bands;
}

function staffCandidates(peaks, imageHeight) {
  const candidates = [];
  const minimumSpacing=Math.max(3,imageHeight*.002), maximumSpacing=imageHeight*.035;
  for (let first=0;first<peaks.length;first+=1) for(let second=first+1;second<Math.min(peaks.length,first+6);second+=1) {
    const spacing=peaks[second].y-peaks[first].y;
    if(spacing<minimumSpacing||spacing>maximumSpacing) continue;
    const group=[peaks[first],peaks[second]]; let cursor=second,valid=true;
    for(let member=2;member<5;member+=1){
      const expected=peaks[first].y+spacing*member; let best=-1,bestDistance=Infinity;
      for(let index=cursor+1;index<peaks.length&&peaks[index].y<=expected+spacing*.38;index+=1){const distance=Math.abs(peaks[index].y-expected);if(distance<bestDistance){best=index;bestDistance=distance;}}
      if(best<0||bestDistance>spacing*.38){valid=false;break;} group.push(peaks[best]);cursor=best;
    }
    if(!valid) continue;
    const gaps=group.slice(1).map((peak,member)=>peak.y-group[member].y),fittedSpacing=gaps.reduce((sum,gap)=>sum+gap,0)/4;
    const deviation=Math.sqrt(gaps.reduce((sum,gap)=>sum+(gap-fittedSpacing)**2,0)/gaps.length);
    const regularity=Math.max(0,1-deviation/Math.max(1,fittedSpacing*.38));
    const strength=group.reduce((sum,peak)=>sum+Math.min(1,peak.strength/.34),0)/5;
    const confidence=.78*regularity+.22*strength;
    if(confidence>=.48)candidates.push({index:first,lines:group.map(peak=>peak.y),spacing:fittedSpacing,confidence});
  }
  return candidates.toSorted((left, right) => right.confidence - left.confidence);
}

function selectNonOverlappingStaffs(candidates) {
  const selected = [];
  for (const candidate of candidates) {
    const top = candidate.lines[0] - candidate.spacing, bottom = candidate.lines[4] + candidate.spacing;
    if (selected.some(staff => Math.max(top, staff.top) < Math.min(bottom, staff.bottom))) continue;
    selected.push({ ...candidate, top, bottom });
  }
  return selected.toSorted((left, right) => left.lines[0] - right.lines[0]);
}

function darkAt(pixels,width,x,y,threshold){const offset=(y*width+x)*4,gray=.2126*pixels[offset]+.7152*pixels[offset+1]+.0722*pixels[offset+2];return gray<threshold;}

function verticalStaffBoundaries(pixels,width,height,staff,threshold){
  const top=Math.max(0,Math.round(staff.lines[0])),bottom=Math.min(height-1,Math.round(staff.lines[4])),span=bottom-top+1,candidates=[];
  for(let x=0;x<width;x+=1){
    let longest=0,current=0,darkCount=0;
    for(let y=top;y<=bottom;y+=1){if(darkAt(pixels,width,x,y,threshold)){current+=1;darkCount+=1;longest=Math.max(longest,current);}else current=0;}
    // Bar ink may be interrupted where curved/fuzzy staff lines cross it.
    // Requiring both a long run and strong total coverage keeps ordinary note
    // stems out while tolerating those small photographic gaps.
    if(longest>=span*.52&&darkCount>=span*.62)candidates.push(x);
  }
  const bands=[];
  for(const x of candidates){const last=bands.at(-1);if(last&&x<=last.x2+1)last.x2=x;else bands.push({x1:x,x2:x});}
  return bands.map(band=>({x:(band.x1+band.x2)/2,x1:band.x1,x2:band.x2,thickness:band.x2-band.x1+1}));
}

function matchSystemBoundaries(trebleBoundaries,bassBoundaries,width){
  const matches=[];
  for(const treble of trebleBoundaries){
    const bass=bassBoundaries.filter(item=>Math.abs(item.x-treble.x)<=Math.max(5,width*.013)).toSorted((a,b)=>Math.abs(a.x-treble.x)-Math.abs(b.x-treble.x))[0];
    if(!bass)continue;
    const x=(treble.x+bass.x)/2; if(matches.some(item=>Math.abs(item.x-x)<2))continue;
    matches.push({x,x1:Math.min(treble.x1,bass.x1),x2:Math.max(treble.x2,bass.x2),thickness:Math.max(treble.thickness,bass.thickness)});
  }
  matches.sort((a,b)=>a.x-b.x);
  for(let index=0;index<matches.length;index+=1){const item=matches[index],neighbor=matches[index+1],nearLeft=item.x<width*.12,nearRight=item.x>width*.88,double=neighbor&&neighbor.x-item.x<=Math.max(9,width*.012);item.kind=nearLeft?'system-start':double||nearRight?'stop-or-repeat':'measure';item.confidence=Math.min(1,.82+(item.thickness>=2?.08:0)+(nearLeft||nearRight?.06:0));if(double){neighbor.kind='stop-or-repeat';neighbor.confidence=item.confidence;}}
  return matches;
}

function jianpuVerticalBoundaries(pixels,width,height,system,treble,threshold){
  const top=Math.max(0,Math.round(treble.lines[0]-treble.spacing*6)),bottom=Math.max(top,Math.min(height-1,Math.round(treble.lines[0]-treble.spacing*.65))),minimumRun=Math.max(10,treble.spacing*1.9),columns=[];
  for(let x=0;x<width;x+=1){let longest=0,current=0;for(let y=top;y<=bottom;y+=1){if(darkAt(pixels,width,x,y,threshold)){current+=1;longest=Math.max(longest,current);}else current=0;}if(longest>=minimumRun)columns.push({x,longest});}
  const bands=[];
  for(const column of columns){const last=bands.at(-1);if(last&&column.x<=last.x2+1){last.x2=column.x;last.longest=Math.max(last.longest,column.longest);}else bands.push({x1:column.x,x2:column.x,longest:column.longest});}
  return bands.filter(item=>item.x2-item.x1+1<=Math.max(6,width*.008)).map(item=>({x:(item.x1+item.x2)/2,x1:item.x1,x2:item.x2,thickness:item.x2-item.x1+1,kind:'measure',confidence:Math.min(.98,.78+item.longest/Math.max(1,bottom-top+1)*.2)}));
}

function staffHorizontalExtent(pixels,width,height,staff,threshold){
  const starts=[],ends=[];
  for(const line of staff.lines){const y=Math.max(0,Math.min(height-1,Math.round(line)));let first=-1,last=-1;for(let x=0;x<width;x+=1){if([-1,0,1].some(dy=>y+dy>=0&&y+dy<height&&darkAt(pixels,width,x,y+dy,threshold))){if(first<0)first=x;last=x;}}if(first>=0){starts.push(first);ends.push(last);}}
  const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
  return starts.length?{left:median(starts),right:median(ends)}:null;
}

/**
 * Locate printed five-line staffs and pair adjacent treble/bass staffs into
 * SATB hymn systems. This stage extracts geometry only; it deliberately does
 * not recognize notes or emit MusicXML.
 */
export function extractStaffRegions(rgba, width, height, { inkThreshold = 175, minimumLineCoverage = .14 } = {}) {
  const pixels = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba || []);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || pixels.length !== width * height * 4) throw new Error('RGBA data must match the positive image dimensions.');
  const profile = grayscaleInkProfile(pixels, width, height, inkThreshold);
  // Curved/faint photographed lines can peak at different coverage levels.
  // Pool several conservative row profiles, then let the non-overlap selector
  // keep the best-supported five-line fit for each physical staff.
  const coverageLevels=[minimumLineCoverage,.16,.18,.2].filter((value,index,list)=>value<=.22&&list.indexOf(value)===index);
  const candidates=coverageLevels.flatMap(coverage=>staffCandidates(rowLinePeaks(profile,width,{minimumCoverage:coverage}),height));
  const staffs = selectNonOverlappingStaffs(candidates).map((staff, index) => ({
    id: `staff-${index + 1}`,
    role: index % 2 ? 'bass' : 'treble',
    lines: staff.lines.map(value => Math.round(value * 10) / 10),
    spacing: Math.round(staff.spacing * 10) / 10,
    confidence: Math.round(staff.confidence * 1000) / 1000,
    bbox: {
      x: 0,
      y: Math.max(0, Math.floor(staff.lines[0] - staff.spacing * 2.2)),
      width,
      height: Math.min(height, Math.ceil(staff.lines[4] + staff.spacing * 2.2)) - Math.max(0, Math.floor(staff.lines[0] - staff.spacing * 2.2)),
    },
  }));
  const systems = [];
  for (let index = 0; index + 1 < staffs.length; index += 2) {
    const treble = staffs[index], bass = staffs[index + 1];
    const previousSystem=systems.at(-1),previousBottom=previousSystem?previousSystem.bbox.y+previousSystem.bbox.height:null;
    const nextTop = staffs[index + 2]?.bbox.y;
    const naturalTop = Math.max(0, Math.floor(treble.lines[0] - treble.spacing * 4));
    const naturalBottom = Math.min(height, Math.ceil(bass.lines[4] + bass.spacing * 4));
    const top = previousBottom === null ? naturalTop : Math.max(naturalTop, Math.floor((previousBottom + naturalTop) / 2));
    const bottom = nextTop === undefined ? naturalBottom : Math.min(naturalBottom, Math.ceil((naturalBottom + nextTop) / 2));
    systems.push({
      id: `system-${systems.length + 1}`,
      staffIds: [treble.id, bass.id],
      confidence: Math.round(Math.min(treble.confidence, bass.confidence) * 1000) / 1000,
      bbox: { x: 0, y: top, width, height: Math.max(1, bottom - top) },
    });
  }
  const unpairedStaffIds = staffs.length % 2 ? [staffs.at(-1).id] : [];
  const boundaries=[];
  for(const system of systems){
    const treble=staffs.find(staff=>staff.id===system.staffIds[0]),bass=staffs.find(staff=>staff.id===system.staffIds[1]);
    const staffMatched=matchSystemBoundaries(verticalStaffBoundaries(pixels,width,height,treble,inkThreshold),verticalStaffBoundaries(pixels,width,height,bass,inkThreshold),width),jianpu=jianpuVerticalBoundaries(pixels,width,height,system,treble,inkThreshold),trebleExtent=staffHorizontalExtent(pixels,width,height,treble,inkThreshold),bassExtent=staffHorizontalExtent(pixels,width,height,bass,inkThreshold),combined=[];
    const leftX=trebleExtent&&bassExtent?Math.min(trebleExtent.left,bassExtent.left):staffMatched[0]?.x,rightX=trebleExtent&&bassExtent?Math.max(trebleExtent.right,bassExtent.right):staffMatched.at(-1)?.x;
    const left=Number.isFinite(leftX)?{x:leftX,x1:leftX,x2:leftX,thickness:Math.max(1,staffMatched[0]?.thickness||1),kind:'system-start',confidence:.94}:null,right=Number.isFinite(rightX)?{x:rightX,x1:rightX,x2:rightX,thickness:Math.max(1,staffMatched.at(-1)?.thickness||1),kind:'stop-or-repeat',confidence:.9}:null;
    if(left)combined.push(left);
    for(const candidate of jianpu){if(!combined.some(item=>Math.abs(item.x-candidate.x)<=Math.max(3,width*.006)))combined.push(candidate);}
    if(right&&right!==left&&!combined.some(item=>Math.abs(item.x-right.x)<=Math.max(3,width*.006))){if(right.x>width*.86)right.kind='stop-or-repeat';combined.push(right);}
    combined.sort((a,b)=>a.x-b.x);
    for(let index=0;index<combined.length-1;index+=1)if(combined[index+1].x-combined[index].x<=Math.max(9,width*.012)){combined[index].kind='stop-or-repeat';combined[index+1].kind='stop-or-repeat';}
    for(const [index,boundary] of combined.entries())boundaries.push({...boundary,id:`${system.id}-boundary-${index+1}`,systemId:system.id});
    const usable=combined.filter(item=>item.kind==='system-start'||item.kind==='measure'||item.kind==='stop-or-repeat');
    if(usable.length>=2){system.contentX1=Math.round(usable[0].x);system.contentX2=Math.round(usable.at(-1).x);system.boundaryIds=combined.map((item,index)=>`${system.id}-boundary-${index+1}`);}
  }
  const warnings = [];
  if (!staffs.length) warnings.push('No reliable five-line staff was found.');
  if (unpairedStaffIds.length) warnings.push('One detected staff could not be paired into a treble/bass hymn system.');
  if (staffs.some(staff => staff.confidence < .68)) warnings.push('At least one staff boundary has low confidence and needs visual review.');
  if(systems.some(system=>!Number.isFinite(system.contentX1)||!Number.isFinite(system.contentX2)))warnings.push('At least one system does not have reliable left and right vertical boundaries.');
  const confidence = staffs.length ? staffs.reduce((sum, staff) => sum + staff.confidence, 0) / staffs.length : 0;
  return {
    schemaVersion: 1,
    stage: systems.length ? 'staff-regions-extracted' : 'staff-region-extraction-failed',
    image: { width, height },
    staffs,
    systems,
    boundaries,
    unpairedStaffIds,
    warnings,
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

export function recognitionSlot(item = {}) {
  const measure = finite(item.measure) ? Number(item.measure) : '?';
  const onset = finite(item.onset) ? Number(item.onset).toFixed(6) : '?';
  const voice = VOICES.has(item.voice) ? item.voice : '?';
  const kind = SYMBOL_KINDS.has(item.kind) ? item.kind : '?';
  const member = item.memberIndex === undefined ? '' : `:${item.memberIndex}`;
  return `${measure}:${onset}:${voice}:${kind}${member}`;
}

export function normalizeRecognitionObservation(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const kind = SYMBOL_KINDS.has(item.kind) ? item.kind : null;
  const voice = VOICES.has(item.voice) ? item.voice : null;
  const bbox = item.bbox && ['x', 'y', 'width', 'height'].every(key => finite(item.bbox[key]))
    ? Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(item.bbox[key])]))
    : null;
  if (!kind || !finite(item.measure) || !finite(item.onset) || !bbox || bbox.width <= 0 || bbox.height <= 0) return null;
  return {
    id: String(item.id || `photo-evidence-${index + 1}`),
    kind,
    voice,
    measure: Number(item.measure),
    onset: Number(item.onset),
    duration: finite(item.duration) ? Number(item.duration) : null,
    value: item.value ?? null,
    bbox,
    confidence: clamp01(item.confidence),
    source: String(item.source || 'primary-recognizer'),
    cropRef: item.cropRef ? String(item.cropRef) : null,
    memberIndex: item.memberIndex === undefined ? undefined : Number(item.memberIndex),
    decision: DECISIONS.has(item.decision) ? item.decision : null,
  };
}

export function buildEvidenceManifest({ source = '', image = {}, observations = [] } = {}) {
  const rejected = [];
  const items = [];
  for (const [index, observation] of observations.entries()) {
    const normalized = normalizeRecognitionObservation(observation, index);
    if (normalized) items.push(normalized);
    else rejected.push({ index, reason: 'Observation is missing a supported symbol kind, measure/onset, or positive bounding box.' });
  }
  const duplicateIds = items.filter((item, index) => items.findIndex(candidate => candidate.id === item.id) !== index).map(item => item.id);
  if (duplicateIds.length) throw new Error(`Duplicate recognition evidence IDs: ${[...new Set(duplicateIds)].join(', ')}`);
  return { schemaVersion: 1, mode: 'development', source: String(source), image: { ...image }, items, rejected };
}

export function reconcileIndependentReadings(primaryItems = [], secondaryItems = [], { agreementBoost = .08 } = {}) {
  const secondaryBySlot = new Map(secondaryItems.map(item => [recognitionSlot(item), item]));
  const evidence = [];
  const conflicts = [];
  for (const primary of primaryItems) {
    const secondary = secondaryBySlot.get(recognitionSlot(primary));
    if (!secondary) {
      evidence.push({ ...primary, corroboration: 'single-reader' });
      continue;
    }
    secondaryBySlot.delete(recognitionSlot(primary));
    if (sameValue(primary.value, secondary.value)) {
      evidence.push({ ...primary, confidence: clamp01(Math.max(primary.confidence, secondary.confidence) + agreementBoost), corroboration: 'independent-agreement', sources: [primary.source, secondary.source] });
    } else {
      evidence.push({ ...primary, corroboration: 'reader-conflict' });
      conflicts.push({
        id: `reader-conflict-${primary.id}`,
        measure: primary.measure,
        voice: primary.voice,
        onset: primary.onset,
        noteId: primary.id,
        ocrValue: evidenceLabel(primary.value),
        inferredValue: evidenceLabel(secondary.value),
        confidence: Math.min(primary.confidence, secondary.confidence),
        reason: 'The independent visual readers disagree at the same registered photo location.',
        conflictType: 'recognizer-disagreement',
        resolution: null,
      });
    }
  }
  for (const secondary of secondaryBySlot.values()) evidence.push({ ...secondary, corroboration: 'secondary-only' });
  return { evidence, conflicts };
}

export function verifyPhotoEvidence(evidence = [], suggestions = []) {
  const suggestionsBySlot = new Map(suggestions.map(item => [recognitionSlot(item), item]));
  const conflicts = [];
  const verified = evidence.map(item => {
    const suggestion = suggestionsBySlot.get(recognitionSlot(item));
    if (!suggestion) return { ...item, verification: 'not-checked' };
    if (sameValue(item.value, suggestion.value)) return { ...item, verification: 'consistent' };
    conflicts.push({
      id: `verification-conflict-${item.id}`,
      measure: item.measure,
      voice: item.voice,
      onset: item.onset,
      noteId: item.id,
      ocrValue: evidenceLabel(item.value),
      inferredValue: evidenceLabel(suggestion.value),
      confidence: item.confidence,
      reason: String(suggestion.reason || 'The photo reading conflicts with the musical verification result.'),
      conflictType: 'evidence-versus-inference',
      resolution: null,
    });
    return { ...item, verification: 'conflict' };
  });
  // Suggestions without corresponding photo evidence are intentionally ignored:
  // inference verifies evidence but cannot manufacture an A/T/B symbol.
  return { evidence: verified, conflicts };
}

export function decideEvidenceEmission(evidence = [], conflicts = [], { acceptConfidence = .82, reviewConfidence = .6 } = {}) {
  const unresolvedByEvidence = new Set(conflicts.filter(conflict => !conflict.resolution).map(conflict => conflict.noteId).filter(Boolean));
  const emitted = [], review = [], blocked = [];
  for (const item of evidence) {
    if (item.decision === 'corrected' || item.decision === 'confirmed-photo') {
      emitted.push({ ...item, emissionReason: item.decision });
    } else if (item.decision === 'deferred' || unresolvedByEvidence.has(item.id) || item.confidence < reviewConfidence) {
      blocked.push({ ...item, emissionReason: item.decision === 'deferred' ? 'deferred' : unresolvedByEvidence.has(item.id) ? 'unresolved-conflict' : 'insufficient-confidence' });
    } else if (item.confidence < acceptConfidence || !['independent-agreement', 'confirmed-photo'].includes(item.corroboration)) {
      review.push({ ...item, emissionReason: 'localized-review' });
    } else {
      emitted.push({ ...item, emissionReason: 'corroborated-photo-evidence' });
    }
  }
  return {
    decision: blocked.length || review.length ? 'partial-review' : 'accept',
    emitted,
    review,
    blocked,
    counts: { emitted: emitted.length, review: review.length, blocked: blocked.length },
  };
}

export function runRecognitionDevelopmentPipeline({ source, image, primary = [], secondary = [], inference = [] } = {}) {
  const quality = assessStaffPhotoQuality(image);
  if (quality.decision === 'reject') return { mode: 'development', quality, manifest: null, conflicts: [], emission: { decision: 'blocked-photo', emitted: [], review: [], blocked: [], counts: { emitted: 0, review: 0, blocked: 0 } } };
  const primaryManifest = buildEvidenceManifest({ source, image, observations: primary });
  const secondaryManifest = buildEvidenceManifest({ source, image, observations: secondary });
  const reconciled = reconcileIndependentReadings(primaryManifest.items, secondaryManifest.items);
  const verified = verifyPhotoEvidence(reconciled.evidence, inference);
  const conflicts = [...reconciled.conflicts, ...verified.conflicts];
  const emission = decideEvidenceEmission(verified.evidence, conflicts);
  return {
    mode: 'development',
    quality,
    manifest: { ...primaryManifest, items: verified.evidence, rejected: [...primaryManifest.rejected, ...secondaryManifest.rejected] },
    conflicts,
    emission,
  };
}

export function removeSmallDarkComponents(rgba, width, height, { threshold = 128, maxPixels = 6, maxWidth = 4, maxHeight = 4, connectivity = 8, repairGap = 6, repairSupport = 3, preserveSymbolDetail = true } = {}) {
  const pixels = rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba || []);
  const expectedLength = Number(width) * Number(height) * 4;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || pixels.length !== expectedLength) throw new Error('RGBA data must match the positive image dimensions.');
  const cutoff = Math.max(0, Math.min(255, Number(threshold) || 0));
  const areaLimit = Math.max(0, Math.round(Number(maxPixels) || 0));
  const widthLimit = Math.max(0, Math.round(Number(maxWidth) || 0));
  const heightLimit = Math.max(0, Math.round(Number(maxHeight) || 0));
  const dark = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const output = new Uint8ClampedArray(pixels.length);
  const removedMask = new Uint8Array(width * height);
  for (let index = 0; index < dark.length; index += 1) {
    const offset = index * 4;
    const gray = .2126 * pixels[offset] + .7152 * pixels[offset + 1] + .0722 * pixels[offset + 2];
    dark[index] = gray <= cutoff ? 1 : 0;
    if (preserveSymbolDetail) {
      output[offset] = pixels[offset]; output[offset + 1] = pixels[offset + 1]; output[offset + 2] = pixels[offset + 2]; output[offset + 3] = pixels[offset + 3];
    } else {
      const value = dark[index] ? 0 : 255;
      output[offset] = value; output[offset + 1] = value; output[offset + 2] = value; output[offset + 3] = pixels[offset + 3];
    }
  }
  const gapLimit = Math.max(0, Math.min(20, Math.round(Number(repairGap) || 0)));
  const supportLength = Math.max(2, Math.min(10, Math.round(Number(repairSupport) || 0)));
  const reconstruction = gapLimit ? reconstructMusicStructures(dark, width, height, { maxGap: gapLimit, support: supportLength }) : { addedMask: new Uint8Array(width * height), stats: { verticalStructures: 0, measureBoundaries: 0, strongBoundaries: 0, horizontalStructures: 0, repairedByDirection: { horizontal: 0, vertical: 0, diagonal: 0 } } };
  const { addedMask } = reconstruction;
  for (let index = 0; index < addedMask.length; index += 1) {
    if (!addedMask[index]) continue;
    const offset = index * 4;
    output[offset] = 0; output[offset + 1] = 0; output[offset + 2] = 0; output[offset + 3] = 255;
  }
  const directions = connectivity === 4 ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  let removedComponents = 0, removedPixels = 0, keptComponents = 0;
  for (let start = 0; start < dark.length; start += 1) {
    if (!dark[start] || visited[start]) continue;
    const stack = [start], members = [];
    visited[start] = 1;
    let minX = start % width, maxX = minX, minY = Math.floor(start / width), maxY = minY;
    while (stack.length) {
      const current = stack.pop(), x = current % width, y = Math.floor(current / width);
      members.push(current); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (dark[neighbor] && !visited[neighbor]) { visited[neighbor] = 1; stack.push(neighbor); }
      }
    }
    const componentWidth = maxX - minX + 1, componentHeight = maxY - minY + 1;
    const removable = members.length <= areaLimit && componentWidth <= widthLimit && componentHeight <= heightLimit;
    if (!removable) { keptComponents += 1; continue; }
    removedComponents += 1; removedPixels += members.length;
    for (const index of members) {
      removedMask[index] = 1;
      const offset = index * 4;
      output[offset] = 255; output[offset + 1] = 255; output[offset + 2] = 255;
    }
  }
  return { data: output, removedMask, addedMask, stats: { removedComponents, removedPixels, repairedPixels: addedMask.reduce((sum, value) => sum + (value ? 1 : 0), 0), ...reconstruction.stats, keptComponents, preservedOriginalDetail: Boolean(preserveSymbolDetail) } };
}
