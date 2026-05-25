package ModelicaBuiltin
  /* omc-web minimal: full NFModelicaBuiltin.mo triggers a parser OOB during
     class_definition_list → composition → element_list. Reduced to the
     minimum the front-end needs to instantiate trivial models. */
  type StateSelect = enumeration(never, avoid, default, prefer, always);
  type AssertionLevel = enumeration(warning, error);
  type Uncertainty = enumeration(given, sought, refine, propagate);
end ModelicaBuiltin;
