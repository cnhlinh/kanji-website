import { NextResponse } from "next/server";
import type { Client as GradioClientType } from "@gradio/client";
const { Client } = require("@gradio/client") as { Client: typeof GradioClientType };

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const client = await Client.connect(process.env.GRADIO_SPACE!);

    const result = await client.predict("/generate_one", {
      kanji: body.kanji,
      level: String(body.level),
      task_type: body.taskType ?? "mcq_compound_meaning",
      max_new_tokens: body.maxNewTokens ?? 200,
      do_sample: body.doSample ?? false,
      temperature: body.temperature ?? 0.6,
      top_p: body.topP ?? 0.9,
      top_k: body.topK ?? 0,
      repetition_penalty: body.repetitionPenalty ?? 1.1,
      seed: body.seed ?? -1,
    });

    const raw =
      (Array.isArray((result as any).data)
        ? (result as any).data[0]
        : (result as any).data) ?? "";

    return NextResponse.json({
      output: String(raw),
    });
  } catch (e) {
    console.error("Gradio client error", e);
    return NextResponse.json(
      { error: "Failed to generate question" },
      { status: 500 }
    );
  }
}
