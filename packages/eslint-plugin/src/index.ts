import noRestrictedSymbols from "./rules/no-restricted-symbols";
import noNamedAsDefault from "./rules/no-named-as-default";

// import all rules in lib/rules
const plugin = {
  rules: {
    "no-restricted-symbols": noRestrictedSymbols,
    "no-named-as-default": noNamedAsDefault,
  },
};

module.exports = plugin;
