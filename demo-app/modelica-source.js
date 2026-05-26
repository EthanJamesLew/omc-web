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
    id: "cccv-stack",
    name: "CCCV_Stack.mo",
    label: "CCCV_Stack",
    description: "battery stack — annotations + within stripped; still needs MSL types",
    needsMSL: true,
    source: `model CCCV_Stack
  "Charge a stack with constant current - constant voltage characteristic"
  extends Modelica.Icons.Example;
  parameter Modelica.Units.SI.Current Isc = 1200 "Short-circuit current of cell at OCVmax";
  parameter Modelica.Electrical.Batteries.ParameterRecords.ExampleData cellDataOriginal(
    Qnom=18000,
    useLinearSOCDependency=false,
    Ri=cellDataOriginal.OCVmax/Isc,
    Idis=0.001) "Original cell data";
  parameter Modelica.Electrical.Batteries.ParameterRecords.ExampleData cellDataDegraded(
    Qnom=18000,
    useLinearSOCDependency=false,
    Ri=2*cellDataDegraded.OCVmax/Isc,
    Idis=0.001) "Degraded cell data";
  parameter Modelica.Electrical.Batteries.ParameterRecords.StackData
    stackData(
    Ns=3,
    Np=2,
    kDegraded=[1,1],
    cellDataOriginal=cellDataOriginal,
    cellDataDegraded=cellDataDegraded) "Stack data";
  Modelica.Electrical.Batteries.Utilities.CCCVcharger cccvCharger(I=stackData.Np*25, Vend=stackData.Ns*4.2);
  Modelica.Electrical.Analog.Basic.Ground ground;
  Modelica.Electrical.Batteries.BatteryStacksWithSensors.Stack stack(
    stackData=stackData,
    useHeatPort=true,
    SOC0=fill(
          0.1,
          stackData.Ns,
          stackData.Np));
  Modelica.Electrical.Batteries.Utilities.BusTranscription busTranscription(
      Np=stackData.Np, Ns=stackData.Ns);
  Modelica.Thermal.HeatTransfer.Components.ThermalCollectorMatrix thermalCollectorMatrix(
    Ns=stackData.Ns, Np=stackData.Np);
  Modelica.Thermal.HeatTransfer.Sources.FixedTemperature fixedTemperature(T=293.15);
  Modelica.Electrical.Analog.Sensors.MultiSensor multiSensor;
  Modelica.Blocks.Continuous.Integrator energy(u(unit="W"), y(unit="J"));
equation
  connect(ground.p, cccvCharger.n);
  connect(ground.p, stack.n);
  connect(stack.stackBus, busTranscription.stackBus);
  connect(stack.heatPort, thermalCollectorMatrix.port_a);
  connect(thermalCollectorMatrix.port_b, fixedTemperature.port);
  connect(cccvCharger.p, multiSensor.pc);
  connect(multiSensor.pc, multiSensor.pv);
  connect(ground.p, multiSensor.nv);
  connect(multiSensor.nc, stack.p);
  connect(multiSensor.power, energy.u);
end CCCV_Stack;
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
