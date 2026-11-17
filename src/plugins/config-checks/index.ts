import envDeclaredInExample from './env-declared-in-example.js';
import mixedConfigTypes from './mixed-config-types.js';
import nvmrcMatchesEngines from './nvmrc-matches-engines.js';
import typesInDevelopmentDependencies from './types-in-development-dependencies.js';

const rules = {
  'env-declared-in-example': envDeclaredInExample,
  'mixed-config-types': mixedConfigTypes,
  'nvmrc-matches-engines': nvmrcMatchesEngines,
  'types-in-dev-dependencies': typesInDevelopmentDependencies,
};

export default { rules };
