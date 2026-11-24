import { ImageResponse } from "next/og";

export const runtime = "edge";

const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/bungee/Bungee-Regular.ttf";

let fontPromise: Promise<ArrayBuffer> | undefined;

async function getBungeeFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error("Unable to load the Bungee font");
      }
      return response.arrayBuffer();
    });
  }
  return fontPromise;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const heading =
    type === "shipped"
      ? "YOUR PETROCRIB PICK IS ON ITS WAY."
      : "GOOD TASTE. GREAT CHOICE.";

  const fontSize = type === "shipped" ? 42 : 52;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          background: "transparent",
          color: "#080808",
          fontFamily: "Bungee",
          fontSize,
          lineHeight: 1.2,
          letterSpacing: "-1px",
          whiteSpace: "nowrap",
        }}
      >
        {heading}
      </div>
    ),
    {
      width: 1100,
      height: 150,
      fonts: [
        {
          name: "Bungee",
          data: await getBungeeFont(),
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    }
  );
}
