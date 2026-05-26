// Registry of bundled examples + a tiny Modelica syntax highlighter.
//
// Each entry: { id, name (filename), label (sidebar text), description, source }
// `needsMSL: true` flags examples that depend on the Modelica Standard Library
// — those won't compile until MSL is bundled into omc.wasm's MEMFS (tracked
// upstream in re-poc/STATE.md). They're kept here so users can see what we're
// working toward.
window.EXAMPLES = [
  {
    id: "bouncing-ball",
    name: "BouncingBall.mo",
    label: "BouncingBall",
    description: "classic ball with restitution",
    source: `model BouncingBall "The 'classic' bouncing ball model"
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
`,
  },
  {
    id: "freefall-msl",
    name: "FreeFallMSL.mo",
    label: "FreeFallMSL",
    description: "minimum MSL test — extends Modelica.Icons.Example",
    needsMSL: true,
    source: `model FreeFallMSL "Minimum MSL test: free-fall with the Icons.Example marker"
  import Modelica.Icons;
  extends Icons.Example;
  Real h(start=1.0, fixed=true) "height";
  Real v(start=0.0, fixed=true) "velocity";
equation
  der(h) = v;
  der(v) = -9.81;
end FreeFallMSL;
`,
  },
  {
    id: "chua-circuit",
    name: "ChuaCircuit.mo",
    label: "ChuaCircuit",
    description: "Chua's chaotic oscillator — uses MSL Electrical.Analog",
    needsMSL: true,
    source: `model ChuaCircuit "Chua's circuit — the canonical chaotic electronic oscillator"
  import Modelica.Icons;
  import Modelica.Electrical.Analog.Basic;
  import Modelica.Electrical.Analog.Examples.Utilities.NonlinearResistor;

  extends Icons.Example;

  Basic.Inductor   L (L=18,   i(start=0, fixed=true));
  Basic.Resistor   Ro(R=12.5e-3);
  Basic.Conductor  G (G=0.565);
  Basic.Capacitor  C1(C=10,   v(start=4, fixed=true));
  Basic.Capacitor  C2(C=100,  v(start=0, fixed=true));
  NonlinearResistor Nr(Ga(min=-1) = -0.757576,
                       Gb(min=-1) = -0.409091,
                       Ve         = 1);
  Basic.Ground     Gnd;
equation
  connect(L.n,  Ro.p);
  connect(C2.p, G.p);
  connect(L.p,  G.p);
  connect(G.n,  Nr.p);
  connect(C1.p, G.n);
  connect(Ro.n, Gnd.p);
  connect(C2.n, Gnd.p);
  connect(Gnd.p, C1.n);
  connect(Gnd.p, Nr.n);
end ChuaCircuit;
`,
  },
];

// Source loaded into the editor on first mount.
window.MODELICA_SOURCE = window.EXAMPLES[0].source;

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
