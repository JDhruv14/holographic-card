export type Vec2 = [number, number];

/** Colours of the Windows 98 frame. */
export interface Palette {
  face: string;        // window body and buttons
  outer: string;       // outermost bevel, top-left
  light: string;       // highlight bevels
  shadow: string;      // inner shadow bevels
  dark: string;        // outermost bevel, bottom-right
  title: string[];     // title bar gradient, left to right
  titleText: string;
  close: string;       // close button
  ink: string;         // menu and status text, button glyphs
  iconWell: string;
  iconEdge: string;
  wellEdge: string;    // sunken well around the art
  wellDark: string;
  wellLight: string;
  status: string;      // status bar
  statusEdge: string;
}

/**
 * Everything that makes one window. Positions on the figure are in pixels of the
 * cut-out image; positions in the art panel are in reference pixels (the panel is
 * 952 x 978).
 */
export interface HoloConfig {
  title: string;                         // e.g. "charizard.exe"
  status: string;                        // status bar line
  menu?: [string, number][];             // [label, x]; defaults to File Edit View Help
  icon?: { pixels: string[]; colors: Record<string, string> }; // 16 x 16, '.' is clear
  palette: Palette;

  art: string;                           // URL of the cut-out PNG (transparent background)
  figure: {
    rect: [number, number, number];      // x, y, width in the art panel; height follows the image
    grade?: { gamma?: number; tint?: string }; // deepen pale prints (default 1.85); tint non-white areas (default none)
  };
  head: {
    pivot: Vec2;                         // neck: the head turns around this point
    centre: Vec2;                        // centre and radii of the region that turns
    radii: Vec2;
    still?: [number, number, number, number]; // x, y, r0, r1: a part inside that region that must stay put
  };
  backdrop: { centre: Vec2; dark: string; light: string; rays?: number }; // sunburst behind the figure

  breath?: {
    mouth: Vec2;                         // where the breath leaves the figure
    angle: number;                       // direction in degrees: 180 is left, 0 is right
    colors?: [string, string, string];   // core, rim, dark holes
  };
  ember?: { at: Vec2; size: Vec2 };      // small flame fixed to the figure (a tail tip)

  framing?: number;                      // window size relative to the viewport, default 0.8
}
