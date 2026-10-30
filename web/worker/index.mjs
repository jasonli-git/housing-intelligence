// The site's Worker (ARCHITECTURE #454). `make publish` writes the manifest beside
// dist/site; wrangler bundles it, so redirects deploy in the same version as the pages.
import manifest from '../../dist/legacy-redirects.json';
import {createHandler} from './legacy.mjs';

export default createHandler(manifest.entries);
