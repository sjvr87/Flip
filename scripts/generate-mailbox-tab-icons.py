"""Generate mailbox tab icon PNG variants from user reference."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "assets/images/mailbox-tab-reference.png"
OUT_EMPTY = ROOT / "assets/images/mailbox-tab-empty.png"
OUT_UNREAD_BASE = ROOT / "assets/images/mailbox-tab-unread-base.png"


def is_yellow(r: int, g: int, b: int) -> bool:
    return r > 200 and 120 < g < 220 and b < 50


def is_blackish(r: int, g: int, b: int) -> bool:
    return r < 30 and g < 30 and b < 30


def yellow_region(x: int, w: int) -> str:
    if x < w * 0.5:
        return "envelope"
    return "flag"


def remove_envelope(px, w: int, h: int) -> None:
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and is_yellow(r, g, b) and yellow_region(x, w) == "envelope":
                px[x, y] = (255, 255, 255, 255)


def remove_flag(px, w: int, h: int) -> None:
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128 and is_yellow(r, g, b) and yellow_region(x, w) == "flag":
                px[x, y] = (255, 255, 255, 255)


def mailbox_map(x: float, y: float, w: int, h: int) -> tuple[int, int]:
    """Map 26×26 icon viewBox coords onto the reference mailbox bbox."""
    left, top, right, bottom = 156, 33, 683, 595
    bw, bh = right - left, bottom - top
    return int(left + (x / 26) * bw), int(top + (y / 26) * bh)


def draw_flag_down(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Horizontal flag-down — geometry from traced MailboxTabIcon viewBox."""
    black = (0, 0, 0, 255)

    def pt(x: float, y: float) -> tuple[int, int]:
        return mailbox_map(x, y, w, h)

    # Hinge knob on right side of mailbox body
    x0, y0 = pt(19.55, 17.05)
    x1, y1 = pt(21.8, 18.35)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=max(2, (x1 - x0) // 4), fill=black)

    # Horizontal stem
    x0, y0 = pt(11.4, 17.35)
    x1, y1 = pt(19.8, 18.55)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=max(2, (y1 - y0) // 2), fill=black)

    # Swallowtail pennant pointing left
    draw.polygon(
        [pt(11.4, 16.55), pt(11.4, 19.35), pt(7.2, 17.95)],
        fill=black,
    )


def draw_flag_up(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
  """Draw flag-up pennant in reference yellow-orange."""
  sx = w / 876
  sy = h / 630
  accent = (243, 169, 3, 255)
  white = (255, 255, 255, 255)

  # White halo between stem and mailbox body
  draw.rounded_rectangle(
      (int(500 * sx), int(175 * sy), int(520 * sx), int(460 * sy)),
      radius=int(8 * sx),
      fill=white,
  )
  draw.rounded_rectangle(
      (int(500 * sx), int(445 * sy), int(540 * sx), int(475 * sy)),
      radius=int(10 * sx),
      fill=white,
  )
  # Stem
  draw.rounded_rectangle(
      (int(505 * sx), int(185 * sy), int(518 * sx), int(455 * sy)),
      radius=int(6 * sx),
      fill=accent,
  )
  # Hinge pill
  draw.rounded_rectangle(
      (int(502 * sx), int(448 * sy), int(536 * sx), int(472 * sy)),
      radius=int(10 * sx),
      fill=accent,
  )
  # Swallowtail pennant — up, points right
  draw.polygon(
      [
          (int(518 * sx), int(175 * sy)),
          (int(518 * sx), int(265 * sy)),
          (int(580 * sx), int(220 * sy)),
      ],
      fill=accent,
  )
  # Notch for swallowtail
  draw.polygon(
      [
          (int(555 * sx), int(175 * sy)),
          (int(580 * sx), int(195 * sy)),
          (int(555 * sx), int(215 * sy)),
          (int(518 * sx), int(215 * sy)),
          (int(518 * sx), int(175 * sy)),
      ],
      fill=accent,
  )


def main() -> None:
    ref = Image.open(REF).convert("RGBA")
    w, h = ref.size

    # Empty: flag down, no envelope
    empty = ref.copy()
    remove_envelope(empty.load(), w, h)
    remove_flag(empty.load(), w, h)
    draw_flag_down(ImageDraw.Draw(empty), w, h)
    empty.save(OUT_EMPTY)

    # Unread base: flag up, no envelope (likes / follows overlays)
    unread_base = ref.copy()
    remove_envelope(unread_base.load(), w, h)
    unread_base.save(OUT_UNREAD_BASE)

    print(f"Wrote {OUT_EMPTY.name}, {OUT_UNREAD_BASE.name}")


if __name__ == "__main__":
    main()
