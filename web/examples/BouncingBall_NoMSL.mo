model BouncingBall
  parameter Real e = 0.7;
  parameter Real h0 = 1.0;
  parameter Real g = 9.81;
  Real h(start=h0, fixed=true);
  Real v(start=0, fixed=true);
equation
  der(h) = v;
  der(v) = -g;
end BouncingBall;
