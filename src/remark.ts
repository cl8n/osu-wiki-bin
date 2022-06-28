import { join } from 'path';
import { error } from './console';
import { wikiPath } from './wiki';

const wikiImports: Record<string, any> = {};
let processor: any;

async function getProcessor() {
  if (processor == null) {
    const imports = await getImports();
    const newPlugins = [];
    const remarkRc = (await import(join(wikiPath, '.remarkrc.js'))).default;

    for (const plugin of remarkRc.plugins) {
      if (Array.isArray(plugin)) {
        if (plugin[1] === false || plugin[0].match(/^(?:preset-)?lint-/) != null) {
          continue;
        }

        newPlugins.push([
          imports['remark-' + plugin[0]].default,
          plugin[1],
        ]);
      } else {
        if (plugin.match(/^(?:preset-)?lint-/) != null) {
          continue;
        }

        newPlugins.push(imports['remark-' + plugin].default)
      }
    }

    processor = imports.remark.remark()
      .use({
        plugins: newPlugins,
        settings: remarkRc.settings,
      })
      .freeze();
  }

  return processor;
}

async function importFromWiki(moduleName: string) {
  const path = join(wikiPath, 'node_modules', moduleName, 'index.js');
  const module = await import(path)
    .catch(() => {
      error(`${moduleName} is not installed in osu-wiki. Run \`npm install\`.`, 1);
    });

  wikiImports[moduleName] = module;
}

export async function getImports() {
  if (!Object.isFrozen(wikiImports)) {
    const moduleNames = [
      'remark',
      'remark-frontmatter',
      'remark-gfm',
      'to-vfile',
      'unist-util-visit',
    ];

    await Promise.all(moduleNames.map((module) => importFromWiki(module)));
    Object.freeze(wikiImports);
  }

  return wikiImports;
}

export async function getMdAst(filename: string) {
  const processor = await getProcessor();
  const vfile = (await getImports())['to-vfile'].readSync(filename);

  return await processor.run(
    processor.parse(vfile),
    vfile,
  );
}
