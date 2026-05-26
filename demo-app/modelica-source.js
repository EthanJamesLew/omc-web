// Default Modelica source for the playground + a tiny syntax highlighter.
// The default is the classic bouncing ball with restitution — exercises type
// aliases, initial equations, when/reinit event handling.
window.MODELICA_SOURCE = `model BouncingBall "The 'classic' bouncing ball model"
  type Height=Real(unit="m");
  type Velocity=Real(unit="m/s");
  parameter Real e=0.8 "Coefficient of restitution";
  parameter Height h0=1.0 "Initial height";
  Height h "Height";
  Velocity v(start=0.0, fixed=true) "Velocity";
initial equation
  h = h0;
equation
  v = der(h);
  der(v) = -9.81;
  when h<0 then
    reinit(v, -e*pre(v));
  end when;
end BouncingBall;
`;

window.highlightModelica = function (src) {
  const keywords = new Set([
    'model','end','parameter','Real','Integer','Boolean','String','equation',
    'when','then','if','else','elseif','for','in','loop','while','algorithm',
    'function','package','class','connector','record','type','extends',
    'import','annotation','within','constant','discrete','flow','input',
    'output','protected','public','final','redeclare','replaceable',
    'partial','encapsulated','stream','der','pre','reinit','initial','and',
    'or','not','true','false','fixed','start','unit',
  ]);
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  return lines.map(line => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '/' && line[i + 1] === '/') {
        out += `<span class="tk-com">${esc(line.slice(i))}</span>`;
        break;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        out += `<span class="tk-str">${esc(line.slice(i, j + 1))}</span>`;
        i = j + 1;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        if (keywords.has(word)) {
          out += `<span class="tk-kw">${word}</span>`;
        } else if (j < line.length && line[j] === '(') {
          out += `<span class="tk-fn">${word}</span>`;
        } else {
          out += `<span class="tk-id">${word}</span>`;
        }
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] || ''))) {
        let j = i;
        while (j < line.length && /[0-9.eE+\-]/.test(line[j])) {
          if ((line[j] === '+' || line[j] === '-') &&
              !(line[j - 1] === 'e' || line[j - 1] === 'E')) break;
          j++;
        }
        out += `<span class="tk-num">${esc(line.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (/[=<>!+\-*/(),;:]/.test(ch)) {
        out += `<span class="tk-op">${esc(ch)}</span>`;
        i++;
        continue;
      }
      out += esc(ch);
      i++;
    }
    return out;
  }).join('\n');
};
