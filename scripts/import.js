#!/usr/bin/env node

const THREE = require('./three.js');

const SCALE = 0.3;
const DISTANCE = 0.7;
// const DISTANCE = 1.4; // elephant
// const DISTANCE = 0.1; // rat/turtle
// const DISTANCE = 0.3; // penguin
// const DISTANCE = 3; // whale

const _align = (n, alignment) => {
  let alignDiff = n % alignment;
  if (alignDiff > 0) {
    n += alignment - alignDiff;
  }
  return n;
};

const fs = require('fs');

const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const s = fs.readFileSync(process.argv[3], 'utf8');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();

const positions = new Float32Array(j.geometries[0].data.attributes.position.array);
for (let i = 0; i < positions.length; i++) {
  positions[i] *= SCALE;
}
const uvs = new Float32Array(j.geometries[0].data.attributes.uv.array);
const indices = new Uint16Array(j.geometries[0].data.index.array);

const boneIndices = new Float32Array(positions.length / 3);
const boneLines = s.split('\n').map(l => {
  const match = l.match(/^(\S+) <Vector \((.+), (.+), (.+)\)> <Vector \((.+), (.+), (.+)\)>$/);
  if (match) {
    const boneName = match[1];
    const startX = parseFloat(match[2]) * SCALE;
    const startY = parseFloat(match[3]) * SCALE;
    const startZ = parseFloat(match[4]) * SCALE;
    const endX = parseFloat(match[5]) * SCALE;
    const endY = parseFloat(match[6]) * SCALE;
    const endZ = parseFloat(match[7]) * SCALE;
    const line = new THREE.Line3(new THREE.Vector3(startX, startY, startZ), new THREE.Vector3(endX, endY, endZ));
    line.name = boneName;
    line.distance = DISTANCE * SCALE;
    return line;
  } else {
    return null;
  }
}).filter(o => o);
const _getNearestBoneName = p => {
  let bestName = null;
  let bestDistance = Infinity;
  for (let i = 0; i < boneLines.length; i++) {
    const boneLine = boneLines[i];
    const distance = boneLine.closestPointToPoint(p, true, localVector2).distanceTo(p);
    if (distance <= boneLine.distance && distance < bestDistance) {
      bestDistance = distance;
      bestName = boneLine.name;
    }
  }
  if (bestName === null) {
    for (let i = 0; i < boneLines.length; i++) {
      const boneLine = boneLines[i];
      const distance = boneLine.closestPointToPoint(p, true, localVector2).distanceTo(p);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestName = boneLine.name;
      }
    }
    if (!(bestName === 'Head' || bestName === 'Neck')) {
      bestName = null;
    }
  }
  return bestName;
};
for (let i = 0; i < positions.length / 3; i++) {
  const boneName = _getNearestBoneName(localVector.fromArray(positions, i * 3));
  if (boneName === 'Head' || boneName === 'Neck') {
    boneIndices[i] = 0;
  } else if (boneName === 'Thigh.l' || boneName === 'Leg.l' || boneName === 'BackLeg.l') {
    boneIndices[i] = 1;
  } else if (boneName === 'Thigh.r' || boneName === 'Leg.r' || boneName === 'BackLeg.r') {
    boneIndices[i] = 2;
  } else if (boneName === 'Shoulderjoint.l' || boneName === 'Hand.l' || boneName === 'FrontLeg.l') {
    boneIndices[i] = 3;
  } else if (boneName === 'Shoulderjoint.r' || boneName === 'Hand.r' || boneName === 'FrontLeg.r') {
    boneIndices[i] = 4;
  } else if (boneName === 'Wingjoint.l' || boneName === 'Wing.l') {
    boneIndices[i] = 5;
  } else if (boneName === 'Wingjoint.r' || boneName === 'Wing.r') {
    boneIndices[i] = 6;
  } else {
    boneIndices[i] = -1;
  }
}

const dys = new Float32Array(positions.length);
const _getBackBone = boneIndex => {
  const result = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < positions.length / 3; i++) {
    if (boneIndices[i] === boneIndex && positions[i * 3 + 2] > result.z) {
      result.fromArray(positions, i * 3);
    }
  }
  return result;
};
const _getTopBone = boneIndex => {
  let topY = -Infinity;
  const acc = new THREE.Vector3();
  let numVectors = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    if (boneIndices[i] === boneIndex) {
      localVector.fromArray(positions, i * 3);
      if (localVector.y > topY) {
        topY = localVector.y;
      }
      acc.add(localVector);
      numVectors++;
    }
  }
  if (numVectors > 0) {
    acc.divideScalar(numVectors);
  }
  return new THREE.Vector3(acc.x, topY, acc.z);
};
const _getCenterBone = boneIndex => {
  let topX = 0;
  const acc = new THREE.Vector3();
  let numVectors = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    if (boneIndices[i] === boneIndex) {
      localVector.fromArray(positions, i * 3);
      if (Math.abs(localVector.x) < Math.abs(topX)) {
        topX = localVector.x;
      }
      acc.add(localVector);
      numVectors++;
    }
  }
  if (numVectors > 0) {
    acc.divideScalar(numVectors);
  }
  return new THREE.Vector3(topX, acc.y, acc.z);
};
const headBackBone = _getBackBone(0);
const leftLegTopBone = _getTopBone(1);
const rightLegTopBone = _getTopBone(2);
const leftArmTopBone = _getTopBone(3);
const rightArmTopBone = _getTopBone(4);
const leftWingCenterBone = _getCenterBone(5);
const rightWingCenterBone = _getCenterBone(6);
for (let i = 0; i < positions.length / 3; i++) {
  const boneIndex = boneIndices[i];
  if (boneIndex === 0) {
    localVector.fromArray(positions, i * 3).sub(headBackBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 1) {
    localVector.fromArray(positions, i * 3).sub(leftLegTopBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 2) {
    localVector.fromArray(positions, i * 3).sub(rightLegTopBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 3) {
    localVector.fromArray(positions, i * 3).sub(leftArmTopBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 4) {
    localVector.fromArray(positions, i * 3).sub(rightArmTopBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 5) {
    localVector.fromArray(positions, i * 3).sub(leftWingCenterBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else if (boneIndex === 6) {
    localVector.fromArray(positions, i * 3).sub(rightWingCenterBone);
    dys[i * 3 + 0] = localVector.x;
    dys[i * 3 + 1] = localVector.y;
    dys[i * 3 + 2] = localVector.z;
  } else {
    // nothing
  }
}

const size = (() => {
  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  return Float32Array.from([
    geometry.boundingBox.max.x - geometry.boundingBox.min.x,
    geometry.boundingBox.max.y - geometry.boundingBox.min.y,
    geometry.boundingBox.max.z - geometry.boundingBox.min.z
  ]);
})();

let buffer = Uint32Array.from([positions.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([uvs.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([indices.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([boneIndices.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));
buffer = Uint32Array.from([dys.length]);
process.stdout.write(new Buffer(buffer.buffer, buffer.byteOffset, buffer.byteLength));

let byteOffset = 0;
process.stdout.write(new Buffer(positions.buffer, positions.byteOffset, positions.byteLength));
byteOffset += positions.byteLength;
process.stdout.write(new Buffer(uvs.buffer, uvs.byteOffset, uvs.byteLength));
byteOffset += uvs.byteLength;
process.stdout.write(new Buffer(indices.buffer, indices.byteOffset, indices.byteLength));
byteOffset += indices.byteLength;
const alignDiff = byteOffset % 4;
if (alignDiff > 0) {
  const alignOffset = 4 - alignDiff;
  process.stdout.write(new Buffer(alignOffset));
  byteOffset += alignOffset;
}
process.stdout.write(new Buffer(boneIndices.buffer, boneIndices.byteOffset, boneIndices.byteLength));
byteOffset += boneIndices.byteLength;
process.stdout.write(new Buffer(dys.buffer, dys.byteOffset, dys.byteLength));
byteOffset += dys.byteLength;
process.stdout.write(new Buffer(size.buffer, size.byteOffset, size.byteLength));
byteOffset += dys.byteLength;
