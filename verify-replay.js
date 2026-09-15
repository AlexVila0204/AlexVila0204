#!/usr/bin/env node
// Re-simulates a submitted Pac-Man run and prints GitHub Actions outputs.
// Usage: ISSUE_BODY="..." node verify-replay.js   (or: node verify-replay.js < body.txt)
// Never throws: any problem becomes verified=false with a reason.

const { PacmanGame, MAX_SCORE } = require('./game.js');

function readBody() {
  if (process.env.ISSUE_BODY) return process.env.ISSUE_BODY;
  try { return require('fs').readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function verify(body) {
  const m = String(body).match(/<!--\s*pacman-score:(\{[^]*?\})\s*-->/);
  if (!m) return { verified: false, reason: 'no replay block found' };

  let payload;
  try { payload = JSON.parse(m[1]); } catch (e) { return { verified: false, reason: 'replay block is not valid JSON' }; }
  if (payload.v !== 2) return { verified: false, reason: 'old submission format, please play again' };

  const claimed = Number(payload.score);
  if (!Number.isInteger(claimed) || claimed <= 0 || claimed > MAX_SCORE || claimed % 10 !== 0) {
    return { verified: false, reason: `impossible score ${payload.score}` };
  }

  const result = PacmanGame.replay(payload);
  if (!result.ok) return { verified: false, reason: result.reason };
  if (result.state !== 'GAMEOVER' && result.state !== 'VICTORY') {
    return { verified: false, reason: `replay does not end the game (state ${result.state})` };
  }
  if (result.score !== claimed) {
    return { verified: false, reason: `replay scores ${result.score}, not ${claimed}` };
  }
  return { verified: true, score: result.score, commits: result.commits, total: result.total, frames: result.frames, state: result.state };
}

const out = verify(readBody());
const lines = [
  `verified=${out.verified ? 'true' : 'false'}`,
  `score=${out.score || 0}`,
  `commits=${out.commits || 0}`,
  `frames=${out.frames || 0}`,
  `reason=${(out.reason || 'ok').replace(/[\r\n]+/g, ' ')}`
];
process.stdout.write(lines.join('\n') + '\n');
