import type { RenderConfig, RenderManifest, RenderTimelineScene } from '../../types/documentation';
import type { FfmpegOverlayGraph, FfmpegOverlayInstruction } from './types';

function msToSeconds(ms: number): number {
  return ms / 1000;
}

function enableBetween(startMs: number, endMs: number): string {
  return `between(t,${msToSeconds(startMs).toFixed(3)},${msToSeconds(endMs).toFixed(3)})`;
}

function buildCalloutAnimExpr(animType: string, startMs: number, durationMs: number): string {
  if (animType === 'fade') {
    const startS = msToSeconds(startMs);
    const fadeInEnd = startS + 0.25;
    const fadeOutStart = msToSeconds(startMs + durationMs) - 0.25;
    return `if(between(t,${startS.toFixed(3)},${fadeInEnd.toFixed(3)}),(t-${startS.toFixed(3)})/0.25,if(between(t,${fadeInEnd.toFixed(3)},${fadeOutStart.toFixed(3)}),1,(${msToSeconds(startMs + durationMs).toFixed(3)}-t)/0.25))`;
  }
  if (animType === 'pop') {
    const startS = msToSeconds(startMs);
    const popEnd = startS + 0.15;
    return `if(between(t,${startS.toFixed(3)},${popEnd.toFixed(3)}),(t-${startS.toFixed(3)})/0.15,1)`;
  }
  return '1';
}

function buildOverlaysForScene(
  scene: RenderTimelineScene,
  config: RenderConfig,
  inputVideoLabel: string,
  layerOffset: number,
  extraInputBaseIndex: number,
  extraInputFiles: string[],
): { instructions: FfmpegOverlayInstruction[]; finalLabel: string } {
  const instructions: FfmpegOverlayInstruction[] = [];
  let currentLabel = inputVideoLabel;
  let layer = layerOffset;

  for (let oi = 0; oi < scene.screenshot_overlays.length; oi++) {
    const ovl = scene.screenshot_overlays[oi];
    const overlayInputIdx = extraInputBaseIndex + extraInputFiles.length;
    extraInputFiles.push(ovl.file_url);

    const outputLabel = `v_ovl_${scene.scene_order}_${oi}`;
    const enableExpr = enableBetween(ovl.display_start_ms, ovl.display_end_ms);

    let filterFragment: string;

    if (ovl.zoom_region) {
      const { x, y, width, height } = ovl.zoom_region;
      const cropLabel = `ovl_${scene.scene_order}_${oi}_zoom`;
      const cropFilter = `[${overlayInputIdx}:v]crop=${width}:${height}:${x}:${y},scale=${config.video.width}:${config.video.height}[${cropLabel}]`;
      filterFragment = `${cropFilter};[${currentLabel}][${cropLabel}]overlay=0:0:enable='${enableExpr}'[${outputLabel}]`;
    } else {
      filterFragment = `[${currentLabel}][${overlayInputIdx}:v]overlay=0:0:enable='${enableExpr}'[${outputLabel}]`;
    }

    instructions.push({
      kind: 'screenshot',
      sceneId: scene.scene_id,
      inputLabel: currentLabel,
      outputLabel,
      filterFragment,
      enableExpression: enableExpr,
      layerOrder: layer++,
    });

    currentLabel = outputLabel;
  }

  if (scene.zoom_effect) {
    const { region, start_ms, duration_ms } = scene.zoom_effect;
    const enableExpr = enableBetween(start_ms, start_ms + duration_ms);
    const outputLabel = `v_zoom_${scene.scene_order}`;

    const zx = `if(${enableExpr},${region.x},0)`;
    const zy = `if(${enableExpr},${region.y},0)`;
    const zz = `if(${enableExpr},${(config.video.width / region.width).toFixed(4)},1)`;

    const filterFragment =
      `[${currentLabel}]zoompan=z='${zz}':x='${zx}':y='${zy}'` +
      `:d=${Math.round((duration_ms / 1000) * config.video.fps)}:s=${config.video.width}x${config.video.height}[${outputLabel}]`;

    instructions.push({
      kind: 'zoom_box',
      sceneId: scene.scene_id,
      inputLabel: currentLabel,
      outputLabel,
      filterFragment,
      enableExpression: enableExpr,
      layerOrder: layer++,
    });

    currentLabel = outputLabel;
  }

  if (scene.highlight_effect) {
    const { region, start_ms, duration_ms } = scene.highlight_effect;
    const enableExpr = enableBetween(start_ms, start_ms + duration_ms);
    const outputLabel = `v_hl_${scene.scene_order}`;

    const filterFragment =
      `[${currentLabel}]drawbox=x=${region.x}:y=${region.y}:w=${region.width}:h=${region.height}` +
      `:color=yellow@0.4:t=4:enable='${enableExpr}'[${outputLabel}]`;

    instructions.push({
      kind: 'highlight_box',
      sceneId: scene.scene_id,
      inputLabel: currentLabel,
      outputLabel,
      filterFragment,
      enableExpression: enableExpr,
      layerOrder: layer++,
    });

    currentLabel = outputLabel;
  }

  if (scene.callout && config.callouts.enabled) {
    const { title, description, start_ms, duration_ms } = scene.callout;
    const enableExpr = enableBetween(start_ms, start_ms + duration_ms);
    const outputLabel = `v_callout_${scene.scene_order}`;
    const animExpr = buildCalloutAnimExpr(config.callouts.animation, start_ms, duration_ms);

    const lines: string[] = [title];
    if (description) lines.push(description);
    const escapedText = lines.join('\\n').replace(/'/g, "\\'").replace(/:/g, '\\:');

    const boxColor = config.callouts.style === 'pill' ? 'black@0.75' : 'black@0.65';
    const boxBorderW = config.callouts.style === 'box' ? '0' : '12';
    const yPos = config.captions.position === 'top' ? 'h*0.05' : 'h*0.72';

    const filterFragment =
      `[${currentLabel}]drawtext=text='${escapedText}'` +
      `:fontcolor=white:fontsize=${config.captions.font_size}` +
      `:box=1:boxcolor=${boxColor}:boxborderw=${boxBorderW}` +
      `:x=(w-text_w)/2:y=${yPos}` +
      `:alpha='${animExpr}'` +
      `:enable='${enableExpr}'[${outputLabel}]`;

    instructions.push({
      kind: 'callout_text',
      sceneId: scene.scene_id,
      inputLabel: currentLabel,
      outputLabel,
      filterFragment,
      enableExpression: enableExpr,
      layerOrder: layer++,
    });

    currentLabel = outputLabel;
  }

  return { instructions, finalLabel: currentLabel };
}

export function buildFfmpegOverlayGraph(
  manifest: RenderManifest,
  config: RenderConfig,
  sceneVideoLabels: string[],
  extraInputBaseIndex: number,
): FfmpegOverlayGraph {
  const allInstructions: FfmpegOverlayInstruction[] = [];
  const extraInputFiles: string[] = [];
  const finalSceneVideoLabels: string[] = [];

  let layerOffset = 0;

  for (let si = 0; si < manifest.scenes.length; si++) {
    const scene = manifest.scenes[si];
    const inputLabel = sceneVideoLabels[si] ?? `v_scene${si}`;

    const { instructions, finalLabel } = buildOverlaysForScene(
      scene,
      config,
      inputLabel,
      layerOffset,
      extraInputBaseIndex,
      extraInputFiles,
    );

    allInstructions.push(...instructions);
    finalSceneVideoLabels.push(finalLabel);
    layerOffset += instructions.length + 1;
  }

  return {
    instructions: allInstructions,
    extraInputFiles,
    finalSceneVideoLabels,
  };
}
