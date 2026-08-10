import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile, parseYaml } from "obsidian";
import type ObsidianViewerPlugin from "../main";

type Answer = string | string[] | Record<string, string> | undefined;

interface QuizOption {
  id: string;
  text: string;
}

interface QuizPrompt extends QuizOption {}

interface QuizQuestion {
  id: string;
  type: "multiple-choice" | "true-false" | "multiple-select" | "short-text" | "numeric" | "matching" | "reorder";
  prompt: string;
  points?: number;
  explanation?: string;
  options?: QuizOption[];
  correctAnswer?: string | number | boolean;
  correctAnswers?: string[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  tolerance?: number;
  scoring?: "exact" | "partial";
  prompts?: QuizPrompt[];
  choices?: QuizOption[];
  correctMatches?: Record<string, string>;
  items?: QuizOption[];
  correctOrder?: string[];
}

interface QuizDefinition {
  id: string;
  title?: string;
  description?: string;
  mode?: "all-at-once" | "one-at-a-time";
  passingScore?: number;
  persistAnswers?: boolean;
  questions: QuizQuestion[];
}

export interface QuizProgress {
  answers: Record<string, Answer>;
  page: number;
  submitted: boolean;
}

interface Score {
  ratio: number;
  points: number;
  total: number;
}

export function registerQuizProcessors(plugin: ObsidianViewerPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("quiz", (source, el) => {
    el.addClass("ov-quiz-definition");
    try {
      const definition = unwrapQuiz(parseYaml(source));
      el.setText(definition?.id ? `题库定义：${definition.id}` : "题库定义");
    } catch {
      el.setText("题库定义格式错误");
    }
  });

  plugin.registerMarkdownCodeBlockProcessor("playable-quiz", (source, el, context) => {
    const child = new QuizRenderChild(el, source, context, plugin);
    context.addChild(child);
  });
}

class QuizRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly context: MarkdownPostProcessorContext,
    private readonly plugin: ObsidianViewerPlugin,
  ) {
    super(containerEl);
  }

  onload(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const quiz = await this.resolveQuiz();
      validateQuiz(quiz);
      this.renderQuiz(quiz);
    } catch (error) {
      this.containerEl.empty();
      this.containerEl.createDiv({
        text: `Quizzable：${error instanceof Error ? error.message : String(error)}`,
        cls: "ov-quiz-error",
      });
    }
  }

  private async resolveQuiz(): Promise<QuizDefinition> {
    const parsed = parseYaml(this.source) as unknown;
    const direct = unwrapQuiz(parsed);
    if (direct?.questions?.length) return direct;

    const record = asRecord(parsed);
    const definitions = await this.readDefinitions();
    const id = typeof record?.id === "string" ? record.id : null;
    if (id && definitions.has(id)) return definitions.get(id)!;
    if (record?.source === "current") {
      const first = definitions.values().next().value as QuizDefinition | undefined;
      if (first) return first;
    }
    throw new Error(id ? `找不到题库定义：${id}` : "需要完整 quiz、题库 id，或 source: current。");
  }

  private async readDefinitions(): Promise<Map<string, QuizDefinition>> {
    const definitions = new Map<string, QuizDefinition>();
    const file = this.plugin.app.vault.getAbstractFileByPath(this.context.sourcePath);
    if (!(file instanceof TFile)) return definitions;
    const markdown = await this.plugin.app.vault.cachedRead(file);
    const pattern = /```quiz\s*\n([\s\S]*?)```/gi;
    for (const match of markdown.matchAll(pattern)) {
      try {
        const quiz = unwrapQuiz(parseYaml(match[1] ?? ""));
        if (quiz?.id) definitions.set(quiz.id, quiz);
      } catch {
        // The visible definition block reports malformed YAML separately.
      }
    }
    return definitions;
  }

  private renderQuiz(quiz: QuizDefinition): void {
    const key = `${this.context.sourcePath}:${quiz.id}`;
    const stored = this.plugin.getQuizProgress(key);
    const state: QuizProgress = {
      answers: { ...stored.answers },
      page: Number.isFinite(stored.page) ? stored.page : 0,
      submitted: Boolean(stored.submitted),
    };
    const questions = quiz.questions;
    state.page = Math.max(0, Math.min(state.page, questions.length - 1));

    const save = (): void => {
      if (quiz.persistAnswers !== false) this.plugin.setQuizProgress(key, state);
    };

    const draw = (): void => {
      this.containerEl.empty();
      const card = this.containerEl.createDiv({ cls: "ov-quiz-card" });
      card.createEl("h3", { text: quiz.title || quiz.id });
      if (quiz.description) card.createDiv({ text: quiz.description, cls: "ov-quiz-description" });

      if (state.submitted) this.renderTotal(card, quiz, state);

      const oneAtATime = quiz.mode !== "all-at-once";
      const visibleQuestions = oneAtATime ? [questions[state.page]!] : questions;
      visibleQuestions.forEach((question) => this.renderQuestion(card, question, state, save, draw));

      if (oneAtATime) {
        const navigation = card.createDiv({ cls: "ov-quiz-nav" });
        const previous = navigation.createEl("button", { text: "上一题" });
        previous.disabled = state.page === 0;
        previous.addEventListener("click", () => {
          state.page = Math.max(0, state.page - 1);
          save();
          draw();
        });
        navigation.createSpan({ text: `${state.page + 1}/${questions.length}` });
        const next = navigation.createEl("button", { text: "下一题" });
        next.disabled = state.page >= questions.length - 1;
        next.addEventListener("click", () => {
          state.page = Math.min(questions.length - 1, state.page + 1);
          save();
          draw();
        });
      }

      const actions = card.createDiv({ cls: "ov-quiz-actions" });
      const submit = actions.createEl("button", { text: state.submitted ? "重新评分" : "提交", cls: "mod-cta" });
      submit.addEventListener("click", () => {
        state.submitted = true;
        save();
        draw();
      });
      const retry = actions.createEl("button", { text: "重新作答" });
      retry.addEventListener("click", () => {
        state.answers = {};
        state.submitted = false;
        state.page = 0;
        this.plugin.setQuizProgress(key, state);
        draw();
      });
    };

    draw();
  }

  private renderQuestion(card: HTMLElement, question: QuizQuestion, state: QuizProgress, save: () => void, draw: () => void): void {
    const section = card.createEl("section", { cls: "ov-quiz-question" });
    section.createEl("strong", { text: question.prompt });
    const answer = state.answers[question.id];
    const disabled = state.submitted;

    if (question.type === "multiple-choice" || question.type === "true-false") {
      const options = question.type === "true-false"
        ? [{ id: "true", text: "True" }, { id: "false", text: "False" }]
        : question.options ?? [];
      options.forEach((option) => {
        const label = section.createEl("label", { cls: "ov-quiz-option" });
        const input = label.createEl("input", { type: "radio", attr: { name: `${question.id}-${this.context.sourcePath}` } });
        input.value = option.id;
        input.checked = String(answer ?? "") === String(option.id);
        input.disabled = disabled;
        label.createSpan({ text: option.text });
        input.addEventListener("change", () => {
          state.answers[question.id] = option.id;
          save();
        });
      });
    } else if (question.type === "multiple-select") {
      const selected = new Set(asStringArray(answer));
      (question.options ?? []).forEach((option) => {
        const label = section.createEl("label", { cls: "ov-quiz-option" });
        const input = label.createEl("input", { type: "checkbox" });
        input.checked = selected.has(option.id);
        input.disabled = disabled;
        label.createSpan({ text: option.text });
        input.addEventListener("change", () => {
          if (input.checked) selected.add(option.id); else selected.delete(option.id);
          state.answers[question.id] = [...selected];
          save();
        });
      });
    } else if (question.type === "short-text" || question.type === "numeric") {
      const input = section.createEl("input", {
        type: question.type === "numeric" ? "number" : "text",
        cls: "ov-quiz-text-input",
      });
      input.value = typeof answer === "string" ? answer : "";
      input.disabled = disabled;
      input.addEventListener("input", () => {
        state.answers[question.id] = input.value;
        save();
      });
    } else if (question.type === "matching") {
      const matches = isStringRecord(answer) ? answer : {};
      (question.prompts ?? []).forEach((prompt) => {
        const label = section.createEl("label", { cls: "ov-quiz-match" });
        label.createSpan({ text: prompt.text });
        const select = label.createEl("select");
        select.createEl("option", { text: "—", value: "" });
        (question.choices ?? []).forEach((choice) => select.createEl("option", { text: choice.text, value: choice.id }));
        select.value = matches[prompt.id] ?? "";
        select.disabled = disabled;
        select.addEventListener("change", () => {
          state.answers[question.id] = { ...matches, [prompt.id]: select.value };
          save();
        });
      });
    } else if (question.type === "reorder") {
      const items = question.items ?? [];
      const order = asStringArray(answer).length ? asStringArray(answer) : items.map((item) => item.id);
      const byId = new Map(items.map((item) => [item.id, item]));
      const orderBox = section.createDiv({ cls: "ov-quiz-order" });
      order.forEach((id, index) => {
        const row = orderBox.createDiv({ cls: "ov-quiz-order-row" });
        row.createSpan({ text: `${index + 1}. ${byId.get(id)?.text ?? id}` });
        const up = row.createEl("button", { text: "▲", attr: { "aria-label": "上移" } });
        up.disabled = disabled || index === 0;
        up.addEventListener("click", () => {
          [order[index - 1], order[index]] = [order[index]!, order[index - 1]!];
          state.answers[question.id] = order;
          save();
          draw();
        });
        const down = row.createEl("button", { text: "▼", attr: { "aria-label": "下移" } });
        down.disabled = disabled || index === order.length - 1;
        down.addEventListener("click", () => {
          [order[index], order[index + 1]] = [order[index + 1]!, order[index]!];
          state.answers[question.id] = order;
          save();
          draw();
        });
      });
    }

    if (state.submitted) {
      const result = scoreQuestion(question, state.answers[question.id]);
      const feedback = section.createDiv({
        cls: `ov-quiz-feedback ${result.ratio === 1 ? "is-correct" : "is-wrong"}`,
      });
      feedback.createSpan({ text: result.ratio === 1 ? "正确" : "未完全正确" });
      if (question.explanation) feedback.createSpan({ text: ` — ${question.explanation}` });
    }
  }

  private renderTotal(card: HTMLElement, quiz: QuizDefinition, state: QuizProgress): void {
    const scores = quiz.questions.map((question) => scoreQuestion(question, state.answers[question.id]));
    const score = scores.reduce((sum, item) => sum + item.points, 0);
    const total = scores.reduce((sum, item) => sum + item.total, 0);
    const percent = total ? Math.round(score / total * 100) : 0;
    const result = card.createDiv({ cls: "ov-quiz-result" });
    let suffix = "";
    if (quiz.passingScore !== undefined) suffix = percent >= quiz.passingScore ? " · 通过" : " · 未通过";
    result.setText(`得分 ${score.toFixed(1)}/${total}（${percent}%）${suffix}`);
  }
}

function scoreQuestion(question: QuizQuestion, answer: Answer): Score {
  let ratio = 0;
  if (question.type === "multiple-choice" || question.type === "true-false") {
    ratio = String(answer) === String(question.correctAnswer) ? 1 : 0;
  } else if (question.type === "multiple-select") {
    const actual = new Set(asStringArray(answer));
    const correct = new Set((question.correctAnswers ?? []).map(String));
    if (question.scoring === "partial") {
      const good = [...actual].filter((value) => correct.has(value)).length;
      const bad = [...actual].filter((value) => !correct.has(value)).length;
      ratio = Math.max(0, (good - bad) / Math.max(1, correct.size));
    } else {
      ratio = actual.size === correct.size && [...actual].every((value) => correct.has(value)) ? 1 : 0;
    }
  } else if (question.type === "short-text") {
    const actual = String(answer ?? "").trim();
    ratio = (question.acceptedAnswers ?? []).some((candidate) => {
      const expected = String(candidate).trim();
      return question.caseSensitive ? actual === expected : actual.toLocaleLowerCase() === expected.toLocaleLowerCase();
    }) ? 1 : 0;
  } else if (question.type === "numeric") {
    const actual = Number(answer);
    const expected = Number(question.correctAnswer);
    ratio = Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= Number(question.tolerance ?? 0) ? 1 : 0;
  } else if (question.type === "matching") {
    const actual = isStringRecord(answer) ? answer : {};
    const expected = Object.entries(question.correctMatches ?? {});
    ratio = expected.length ? expected.filter(([key, value]) => actual[key] === value).length / expected.length : 0;
  } else if (question.type === "reorder") {
    ratio = JSON.stringify(asStringArray(answer)) === JSON.stringify(question.correctOrder ?? []) ? 1 : 0;
  }
  const total = Number(question.points ?? 1);
  return { ratio, points: total * ratio, total };
}

function validateQuiz(quiz: QuizDefinition): void {
  if (!quiz || typeof quiz !== "object") throw new Error("题目必须是 YAML 对象。");
  if (!quiz.id || typeof quiz.id !== "string") throw new Error("题目需要 id。");
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) throw new Error("题目需要非空 questions。");
  const ids = new Set<string>();
  quiz.questions.forEach((question, index) => {
    if (!question?.id || !question.type || !question.prompt) throw new Error(`第 ${index + 1} 题缺少 id、type 或 prompt。`);
    if (ids.has(question.id)) throw new Error(`题目 id 重复：${question.id}`);
    ids.add(question.id);
    if (!["multiple-choice", "true-false", "multiple-select", "short-text", "numeric", "matching", "reorder"].includes(question.type)) {
      throw new Error(`不支持的题型：${String(question.type)}`);
    }
  });
}

function unwrapQuiz(value: unknown): QuizDefinition | null {
  const record = asRecord(value);
  if (!record) return null;
  const nested = asRecord(record.quiz);
  return (nested ?? record) as unknown as QuizDefinition;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asStringArray(value: Answer): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function isStringRecord(value: Answer): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
