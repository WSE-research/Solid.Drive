import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ldoDir = './src/.ldo';
const files = readdirSync(ldoDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = join(ldoDir, file);
  let content = readFileSync(filePath, 'utf-8');

  content = content
    // Fix: import { Schema } from "shexj"
    .replace(/^import \{ Schema \} from "shexj";/mg, 'import type { Schema } from "shexj";')
    // Fix: import { ShapeType } from "@ldo/ldo"
    .replace(/^import \{ ShapeType \} from "@ldo\/ldo";/mg, 'import type { ShapeType } from "@ldo/ldo";')
    // Fix: import { LdoJsonldContext } from "@ldo/ldo"
    .replace(/^import \{ LdoJsonldContext \} from "@ldo\/ldo";/mg, 'import type { LdoJsonldContext } from "@ldo/ldo";')
    // Fix: import { LdoJsonldContext, LdSet } from "@ldo/ldo"
    .replace(/^import \{ LdoJsonldContext, LdSet \} from "@ldo\/ldo";/mg, 'import type { LdoJsonldContext, LdSet } from "@ldo/ldo";')
    // Fix: import { PostSh } from "./post.typings"
    .replace(/^import \{ (\w+) \} from "\.\/(\w+)\.typings";/mg, 'import type { $1 } from "./$2.typings";')
    // Fix: import { SolidProfile } from "./solidProfile.typings"
    .replace(/^import \{ (\w+) \} from "\.\/(\w+)\.typings";/mg, 'import type { $1 } from "./$2.typings";');

  writeFileSync(filePath, content, 'utf-8');
  console.log(`✓ Fixed: ${file}`);
}

console.log('\nDone patching .ldo files.');