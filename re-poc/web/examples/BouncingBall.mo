model BouncingBall
  "Classic bouncing ball with coefficient of restitution. Uses Modelica
   Standard Library for the gravitational constant — the most lightweight
   demonstration of MSL coupling. A 'fuller' MSL example would build the
   ball out of Modelica.Mechanics.Translational components, but that
   requires the full Mechanics package to be present in the VFS."

  import Modelica.Constants.g_n;

  parameter Real e   = 0.7  "Coefficient of restitution (-)";
  parameter Real h0  = 1.0  "Initial height (m)";
  parameter Real vth = 0.01 "Velocity threshold for considering the ball at rest (m/s)";

  Real h(start = h0, fixed = true) "Height (m)";
  Real v(start = 0,  fixed = true) "Velocity (m/s)";
  Boolean flying(start = true) "true while the ball is in flight";

equation
  der(h) = v;
  der(v) = if flying then -g_n else 0;

  when h <= 0 and v <= 0 then
    flying = pre(flying) and abs(v) > vth;
    reinit(v, -e * pre(v));
  end when;

  annotation(
    experiment(StartTime = 0, StopTime = 5, Tolerance = 1e-6, Interval = 0.01),
    Documentation(info = "<html>
      <p>Drops a ball from height <code>h0</code> under gravity
      <code>Modelica.Constants.g_n</code> and lets it bounce with restitution
      coefficient <code>e</code>. The ball comes to rest when its rebound
      velocity falls below <code>vth</code>.</p>
    </html>")
  );
end BouncingBall;
