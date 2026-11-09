import fs from 'node:fs';
import { getProject, saveProject } from '../../src/lib/storage/project-store';
import { buildLibraryEnvironment } from '../../src/lib/pipeline/library-environment';
import { loadAssetCatalog } from '../../src/lib/assets/published';
import { buildLibraryFiles, libraryMainVideoCode } from '../../src/lib/pipeline/library-video';
import { validateAssetPlan } from '../../src/lib/assets/plan-schema';
import { assetModel } from '../../src/lib/explainer/scene-generator';
import { LocalRemotionRenderProvider } from '../../src/lib/render/render-service';

async function main() {
  const id = process.argv[2];
  const project = getProject(id);
  if (!project) throw new Error('Project not found');
  const backup = `storage/projects/${id}/before-environment-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify(project, null, 2));
  console.log(`Backup: ${backup}`);
  const built = await (async () => {
    if (process.argv.includes('--modular-example')) {
      const match = /const data = (\{.*\});/.exec(project.files['MainVideo.tsx']);
      if (!match) throw new Error('Saved library plan not found');
      const data = JSON.parse(match[1]);
      const stages = ['coagulation', 'sedimentation', 'filtration', 'disinfection'];
      data.plan.instances = data.plan.instances.filter((item: { id: string }) => item.id !== 'pengolahan' && !stages.includes(item.id));
      data.plan.instances.push(...stages.map((variant) => ({ id: variant, assetId: 'environment.water-treatment', assetVersion: '0.1.0', variant, props: { flowing: true } })));
      stages.forEach((stage, index) => {
        const scene = data.plan.scenes[index + 1];
        scene.instances = [stage]; scene.layout = 'single';
        scene.set = scene.set.map((change: { props: Record<string, unknown> }) => ({ instanceId: stage, props: Object.fromEntries(Object.entries(change.props).filter(([name]) => name !== 'settling' || stage === 'sedimentation')) }));
        scene.focus = scene.focus.map((focus: object) => ({ ...focus, instanceId: stage }));
        scene.actions = scene.actions.map((action: object) => ({ ...action, instanceId: stage }));
        if (stage === 'coagulation') scene.actions = [{ instanceId: stage, prop: 'flocculation', from: 0, to: 1, startSec: 0.5, endSec: scene.durationSec - 0.4, easing: 'ease-in-out' }];
      });
      const chain = ['sungai', ...stages, 'distribusi'];
      data.plan.connections = chain.slice(1).map((id, index) => ({ from: { instanceId: chain[index], anchor: 'outlet' }, to: { instanceId: id, anchor: id === 'distribusi' ? 'waterInlet' : 'inlet' } }));
      const checked = validateAssetPlan(data.plan, await loadAssetCatalog());
      if (!checked.ok) throw new Error(checked.errors.join('\n'));
      return { used: true as const, report: project.libraryReport!, files: {
        'Environment.tsx': project.files['Environment.tsx'],
        'MainVideo.tsx': libraryMainVideoCode(project, checked.plan, [], data.environment),
      } };
    }
    if (process.argv.includes('--house-example')) {
      const match = /const data = (\{.*\});/.exec(project.files['MainVideo.tsx']);
      if (!match) throw new Error('Saved library plan not found');
      const data = JSON.parse(match[1]);
      const house = data.plan.instances.find((item: { id: string }) => item.id === 'distribusi');
      if (!house) throw new Error('Distribution instance not found');
      Object.assign(house, { assetId: 'building.house', assetVersion: '0.1.0', variant: 'residential', props: { view: 'exterior' } });
      data.plan.connections = [{ from: { instanceId: 'pengolahan', anchor: 'outlet' }, to: { instanceId: 'distribusi', anchor: 'waterInlet' } }];
      const last = data.plan.scenes.at(-1);
      Object.assign(last, { layout: 'close-up', camera: { zoom: 12 },
        set: [{ instanceId: 'distribusi', props: { view: 'cutaway', waterRunning: true, plumbingVisible: true } }],
        focus: [{ instanceId: 'distribusi', anchor: 'kitchenFaucet', label: 'Keran dapur' }], actions: [],
      });
      const validation = validateAssetPlan(data.plan, await loadAssetCatalog());
      if (!validation.ok) throw new Error(validation.errors.join('\n'));
      const placement = data.environment;
      if (!placement) throw new Error('Environment placement not found');
      return { used: true as const, report: { ...project.libraryReport!, generated: [], assets: ['environment.water-channel@0.1.0', 'environment.water-treatment@0.1.0', 'building.house@0.1.0'] }, files: {
        'Environment.tsx': project.files['Environment.tsx'],
        'MainVideo.tsx': libraryMainVideoCode(project, validation.plan, [], placement),
      } };
    }
    if (process.argv.includes('--resume')) {
      const candidate = JSON.parse(fs.readFileSync(`storage/projects/${id}/environment-candidate.json`, 'utf8'));
      return { used: true as const, files: candidate.files, report: candidate.libraryReport };
    }
    if (!process.argv.includes('--environment-only')) return buildLibraryFiles(assetModel(project.drawingModel), project);
    const match = /const data = (\{.*\});/.exec(project.files['MainVideo.tsx']);
    if (!match) throw new Error('Saved library plan not found');
    const data = JSON.parse(match[1]);
    const environment = await buildLibraryEnvironment(project.userPrompt, data.plan, [...await loadAssetCatalog(), ...data.published]);
    return { used: true as const, report: project.libraryReport!, files: {
      ...project.files, 'Environment.tsx': environment.code,
      'MainVideo.tsx': libraryMainVideoCode(project, data.plan, data.published, environment.placement),
    } };
  })();
  if (!built.used) throw new Error(`Library not used: ${built.report.fallbackReason}`);
  const updated = { ...project, files: built.files, libraryReport: built.report, updatedAt: Date.now() };
  console.log(`Built: ${Object.keys(built.files).join(', ')}`);
  fs.writeFileSync(`storage/projects/${id}/environment-candidate.json`, JSON.stringify(updated, null, 2));
  const rendered = await new LocalRemotionRenderProvider().renderProject(updated);
  console.log(`Rendered: ${rendered.outputUrl}`);
  updated.chatHistory = [...project.chatHistory.filter((message) => message.id !== 'msg_environment_preview'), { id: 'msg_environment_preview', sender: 'assistant' as const, content: 'Latar lingkungan kini digambar AI: lahan hijau, pepohonan, jalan, dan permukiman mengelilingi aset utama. Sungai diteruskan melewati kamera. Narasi dan audio tetap memakai versi sebelumnya. Ekspor MP4 berhasil.', timestamp: Date.now() }];
  saveProject(updated);
  console.log(`Saved: ${id}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
