export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  chat(params: {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
  stream(params: {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<string>;
}

export interface SessionSummary {
  topicsDiscussed: string[];
  deepDives: string[];
  couldExploreMore: string[];
  notMentioned: string[];
  closingMessage: string;
}
