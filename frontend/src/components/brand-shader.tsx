import { useEffect, useRef } from "preact/hooks";

type BrandShaderProps = {
  text: string;
};

const vertexShaderSource = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  uniform sampler2D u_text;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_ink;
  uniform vec3 u_aqua;
  uniform vec3 u_heat;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float glyph = texture2D(u_text, vec2(uv.x, 1.0 - uv.y)).a;
    float current = sin(uv.x * 6.0 - u_time * 0.7 + sin(uv.y * 8.0 + u_time * 0.45)) * 0.5 + 0.5;
    float ripple = sin(uv.x * 13.0 + uv.y * 5.0 + u_time * 1.1) * 0.5 + 0.5;
    float aqua = smoothstep(0.32, 0.82, current);
    float amber = smoothstep(0.84, 0.98, ripple) * aqua;
    vec3 colour = mix(u_ink, u_aqua, aqua * 0.76);
    colour = mix(colour, u_heat, amber * 0.48);

    gl_FragColor = vec4(colour * glyph, glyph);
  }
`;

function compileShader(
  context: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = context.createShader(type);
  if (!shader) {
    return null;
  }

  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    return shader;
  }

  context.deleteShader(shader);
  return null;
}

function parseColour(value: string, fallback: readonly number[]) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value.trim());
  if (!match) {
    return fallback;
  }

  return match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
}

export function BrandShader({ text }: BrandShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const context = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
    });
    if (!context) {
      return;
    }

    const vertexShader = compileShader(
      context,
      context.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = compileShader(
      context,
      context.FRAGMENT_SHADER,
      fragmentShaderSource,
    );
    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = context.createProgram();
    if (!program) {
      return;
    }

    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    context.linkProgram(program);
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      context.deleteProgram(program);
      return;
    }

    const position = context.getAttribLocation(program, "a_position");
    const textUniform = context.getUniformLocation(program, "u_text");
    const resolutionUniform = context.getUniformLocation(
      program,
      "u_resolution",
    );
    const timeUniform = context.getUniformLocation(program, "u_time");
    const inkUniform = context.getUniformLocation(program, "u_ink");
    const aquaUniform = context.getUniformLocation(program, "u_aqua");
    const heatUniform = context.getUniformLocation(program, "u_heat");
    const buffer = context.createBuffer();
    const texture = context.createTexture();
    if (
      position < 0 ||
      !textUniform ||
      !resolutionUniform ||
      !timeUniform ||
      !inkUniform ||
      !aquaUniform ||
      !heatUniform ||
      !buffer ||
      !texture
    ) {
      context.deleteProgram(program);
      return;
    }

    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      context.STATIC_DRAW,
    );
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MIN_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MAG_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_S,
      context.CLAMP_TO_EDGE,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_T,
      context.CLAMP_TO_EDGE,
    );

    let frame = 0;
    let ready = false;

    const renderText = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      const textCanvas = document.createElement("canvas");
      textCanvas.width = width;
      textCanvas.height = height;
      const textContext = textCanvas.getContext("2d");
      if (!textContext) {
        return false;
      }

      const styles = window.getComputedStyle(canvas);
      textContext.font = styles.font;
      textContext.fillStyle = "#ffffff";
      textContext.textBaseline = "middle";
      textContext.fillText(text, 0, height / 2);
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA,
        context.RGBA,
        context.UNSIGNED_BYTE,
        textCanvas,
      );
      return true;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.viewport(0, 0, canvas.width, canvas.height);
      ready = renderText();
      canvas.parentElement?.setAttribute("data-ready", String(ready));
    };

    const rootStyles = window.getComputedStyle(document.documentElement);
    const ink = parseColour(
      rootStyles.getPropertyValue("--foreground"),
      [1, 1, 1],
    );
    const aqua = parseColour(
      rootStyles.getPropertyValue("--industrial-aqua"),
      [0.31, 0.73, 0.74],
    );
    const heat = parseColour(
      rootStyles.getPropertyValue("--heat-marker"),
      [0.95, 0.57, 0.13],
    );

    const draw = (milliseconds: number) => {
      if (!ready) {
        return;
      }

      context.useProgram(program);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.enableVertexAttribArray(position);
      context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.uniform1i(textUniform, 0);
      context.uniform2f(resolutionUniform, canvas.width, canvas.height);
      context.uniform1f(timeUniform, milliseconds / 1000);
      context.uniform3fv(inkUniform, ink);
      context.uniform3fv(aquaUniform, aqua);
      context.uniform3fv(heatUniform, heat);
      context.drawArrays(context.TRIANGLES, 0, 6);
      frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      context.deleteTexture(texture);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
    };
  }, [text]);

  return (
    <span class="planner-brand__title">
      <span class="planner-brand__shader" aria-hidden="true">
        <canvas ref={canvasRef} />
      </span>
      <span class="planner-brand__title-fallback">{text}</span>
    </span>
  );
}
