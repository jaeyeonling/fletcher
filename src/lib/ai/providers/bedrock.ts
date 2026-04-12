import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { LLMProvider, LLMMessage } from "../types";

export class BedrockProvider implements LLMProvider {
  id = "bedrock";
  name = "AWS Bedrock";
  models = [
    "global.anthropic.claude-sonnet-4-6",
    "global.anthropic.claude-sonnet-4",
    "global.anthropic.claude-haiku-4-5",
  ];

  private _client: BedrockRuntimeClient | null = null;

  private get client(): BedrockRuntimeClient {
    if (!this._client) {
      this._client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION ?? "ap-northeast-2",
        ...(process.env.AWS_ACCESS_KEY_ID && {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
            ...(process.env.AWS_SESSION_TOKEN && {
              sessionToken: process.env.AWS_SESSION_TOKEN,
            }),
          },
        }),
      });
    }
    return this._client;
  }

  private formatMessages(messages: LLMMessage[]): {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    return {
      system: systemMessages.map((m) => m.content).join("\n\n"),
      messages: conversationMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    };
  }

  async chat(params: {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const { system, messages } = this.formatMessages(params.messages);

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      system,
      messages,
    });

    const command = new InvokeModelCommand({
      modelId: params.model,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    });

    const response = await this.client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));

    return result.content?.[0]?.text ?? "";
  }

  async *stream(params: {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<string> {
    const { system, messages } = this.formatMessages(params.messages);

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      system,
      messages,
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: params.model,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    });

    const response = await this.client.send(command);

    if (!response.body) {
      throw new Error("No response stream from Bedrock");
    }

    for await (const event of response.body) {
      if (event.chunk?.bytes) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
        if (chunk.type === "content_block_delta" && chunk.delta?.text) {
          yield chunk.delta.text;
        }
      }
    }
  }
}
