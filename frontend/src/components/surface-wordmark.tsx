import { useEffect, useRef } from "preact/hooks";

type SurfaceWordmarkProps = {
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

  float sampleText(vec2 coordinate) {
    return texture2D(u_text, coordinate).a;
  }

  float grain(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 pixel = 1.0 / u_resolution;
    float text = sampleText(vec2(uv.x, 1.0 - uv.y));
    float left = sampleText(vec2(uv.x - pixel.x * 1.6, 1.0 - uv.y));
    float right = sampleText(vec2(uv.x + pixel.x * 1.6, 1.0 - uv.y));
    float up = sampleText(vec2(uv.x, 1.0 - (uv.y + pixel.y * 1.6)));
    float down = sampleText(vec2(uv.x, 1.0 - (uv.y - pixel.y * 1.6)));
    float surrounding = max(max(left, right), max(up, down));
    float recessedEdge = max(surrounding - text, 0.0);
    float bevel = clamp((right - left) + (up - down), -1.0, 1.0);
    float grit = grain(floor(gl_FragCoord.xy * 1.45));
    vec3 iron = vec3(0.10, 0.13, 0.13);
    vec3 steel = vec3(0.52, 0.58, 0.56);
    vec3 aqua = vec3(0.31, 0.73, 0.74);
    vec3 ember = vec3(0.95, 0.57, 0.13);
    vec3 face = mix(iron, steel, 0.64 + grit * 0.17);
    face += aqua * max(bevel, 0.0) * 0.27;
    face += ember * max(-bevel, 0.0) * 0.18;
    face -= vec3(0.16) * grit;
    vec3 edge = mix(iron, vec3(0.02), grit) * 0.8;
    float alpha = max(text, recessedEdge * 0.42);
    vec3 colour = mix(edge, face, text);

    if (alpha < 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    gl_FragColor = vec4(colour, alpha);
  }
`;

type TransparentShaderSurface = Pick<
  WebGLRenderingContext,
  "blendFunc" | "clear" | "clearColor" | "enable"
> & {
  BLEND: number;
  COLOR_BUFFER_BIT: number;
  ONE_MINUS_SRC_ALPHA: number;
  SRC_ALPHA: number;
};

export function fitWordmarkFontSize({
  maximumWidth,
  measuredWidth,
  preferredSize,
}: {
  maximumWidth: number;
  measuredWidth: number;
  preferredSize: number;
}) {
  if (measuredWidth <= maximumWidth || maximumWidth <= 0) {
    return preferredSize;
  }

  return preferredSize * (maximumWidth / measuredWidth);
}

export function prepareTransparentShaderSurface(
  context: TransparentShaderSurface,
) {
  context.clearColor(0, 0, 0, 0);
  context.clear(context.COLOR_BUFFER_BIT);
  context.enable(context.BLEND);
  context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
}

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

export function SurfaceWordmark({ text }: SurfaceWordmarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
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
    const program = context.createProgram();
    const buffer = context.createBuffer();
    const texture = context.createTexture();
    if (!vertexShader || !fragmentShader || !program || !buffer || !texture) {
      context.deleteShader(vertexShader);
      context.deleteShader(fragmentShader);
      context.deleteProgram(program);
      context.deleteBuffer(buffer);
      context.deleteTexture(texture);
      return;
    }

    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    context.linkProgram(program);
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      context.deleteProgram(program);
      context.deleteBuffer(buffer);
      context.deleteTexture(texture);
      return;
    }

    const position = context.getAttribLocation(program, "a_position");
    const textUniform = context.getUniformLocation(program, "u_text");
    const resolutionUniform = context.getUniformLocation(
      program,
      "u_resolution",
    );
    if (position < 0 || !textUniform || !resolutionUniform) {
      context.deleteProgram(program);
      context.deleteBuffer(buffer);
      context.deleteTexture(texture);
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

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));

      const textCanvas = document.createElement("canvas");
      textCanvas.width = canvas.width;
      textCanvas.height = canvas.height;
      const textContext = textCanvas.getContext("2d");
      if (!textContext) {
        return;
      }

      const styles = window.getComputedStyle(canvas);
      const preferredSize = Number.parseFloat(styles.fontSize) * ratio;
      const font = (size: number) =>
        `${styles.fontWeight} ${size}px ${styles.fontFamily}`;
      const uppercasedText = text.toUpperCase();
      textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
      textContext.font = font(preferredSize);
      const fontSize = fitWordmarkFontSize({
        maximumWidth: textCanvas.width * 0.9,
        measuredWidth: textContext.measureText(uppercasedText).width,
        preferredSize,
      });
      textContext.font = font(fontSize);
      textContext.fillStyle = "#ffffff";
      textContext.textAlign = "center";
      textContext.textBaseline = "middle";
      textContext.fillText(
        uppercasedText,
        textCanvas.width / 2,
        textCanvas.height / 2,
      );

      context.viewport(0, 0, canvas.width, canvas.height);
      prepareTransparentShaderSurface(context);
      context.useProgram(program);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.enableVertexAttribArray(position);
      context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA,
        context.RGBA,
        context.UNSIGNED_BYTE,
        textCanvas,
      );
      context.uniform1i(textUniform, 0);
      context.uniform2f(resolutionUniform, canvas.width, canvas.height);
      context.drawArrays(context.TRIANGLES, 0, 6);
      canvas.parentElement?.setAttribute("data-ready", "true");
    };

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const fontLoad = document.fonts?.load('800 48px "IntraNet"');
    void (fontLoad ?? Promise.resolve()).finally(draw);

    return () => {
      observer.disconnect();
      context.deleteTexture(texture);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
    };
  }, [text]);

  return (
    <span class="planner-identity" role="img" aria-label={text}>
      <span class="planner-identity__shader" aria-hidden="true">
        <canvas ref={canvasRef} />
      </span>
      <span class="planner-identity__label">{text}</span>
    </span>
  );
}
