const PLATFORM_LOGO_BASE_URL = "/platform-icons";

const PLATFORM_LOGO_FILES: Record<string, string> = {
  "game boy advance": "GBA.png",
  "nintendo 64": "N64.png",
  "nintendo gamecube": "GC.png",
  "nintendo switch": "Switch.png",
  "playstation 2": "ps2.png",
  "playstation 3": "ps3.png",
  "playstation 4": "ps4.png",
  "playstation 5": "ps5.png",
  "playstation portable": "psp.png",
  "playstation vita": "psvita.png",
  playstation: "psx.png",
  "super nintendo entertainment system": "Snes.png",
  "wii u": "WiiU.png",
  wii: "Wii.png",
  "sega dreamcast": "Dreamcast.png",
  "pc (microsoft windows)": "Windows.png",
  pc: "Windows.png",
  windows: "Windows.png",
};

interface PlatformIconsProps {
  platforms: string[];
  maxIcons?: number;
  showFallback?: boolean;
  class?: string;
}

function logoFileFor(platform: string): string | undefined {
  const normalized = platform.trim().toLowerCase();
  if (PLATFORM_LOGO_FILES[normalized]) {
    return PLATFORM_LOGO_FILES[normalized];
  }
  if (normalized.startsWith("xbox")) {
    return "Xbox.png";
  }
  if (normalized.startsWith("nintendo switch")) {
    return "Switch.png";
  }
  return undefined;
}

export function PlatformIcons({
  platforms,
  maxIcons = 6,
  showFallback = true,
  class: className = "",
}: PlatformIconsProps) {
  const icons = platforms.reduce<Array<{ platform: string; file: string }>>(
    (current, platform) => {
      const file = logoFileFor(platform);
      if (file && !current.some((icon) => icon.file === file)) {
        current.push({ platform, file });
      }
      return current;
    },
    [],
  );
  const unsupported = platforms.filter((platform) => !logoFileFor(platform));
  const visibleIcons = icons.slice(0, maxIcons);
  const hiddenIconCount = icons.length - visibleIcons.length;

  if (platforms.length === 0) {
    return null;
  }

  return (
    <span
      class={`platform-icons${className ? ` ${className}` : ""}`}
      aria-label={`Platforms: ${platforms.join(", ")}`}
    >
      {visibleIcons.map(({ platform, file }) => (
        <img
          key={file}
          class="platform-icons__icon"
          src={`${PLATFORM_LOGO_BASE_URL}/${file}`}
          alt=""
          title={platform}
          loading="lazy"
          decoding="async"
        />
      ))}
      {hiddenIconCount > 0 && (
        <span
          class="platform-icons__more"
          title={icons
            .slice(maxIcons)
            .map((icon) => icon.platform)
            .join(", ")}
        >
          +{hiddenIconCount}
        </span>
      )}
      {showFallback && unsupported.length > 0 && (
        <span class="platform-icons__fallback">{unsupported.join(", ")}</span>
      )}
    </span>
  );
}
