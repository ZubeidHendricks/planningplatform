import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPlanDimension {
  name: string;
  slug: string;
  members: Array<{ name: string; code: string }>;
}

export interface ModelPlanBlock {
  name: string;
  slug: string;
  blockType: 'metric' | 'dimension_list' | 'transaction_list' | 'table';
  description: string;
  formula: string | null;
  formatType: 'number' | 'currency' | 'percentage';
  dimensionSlugs: string[];
}

export interface ModelPlan {
  description: string;
  dimensions: ModelPlanDimension[];
  blocks: ModelPlanBlock[];
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKeys: string[];
}

export interface AnalysisHighlight {
  metric: string;
  value: number;
  insight: string;
}

export interface AnalysisResult {
  answer: string;
  chartConfig?: ChartConfig;
  highlights?: AnalysisHighlight[];
}

export interface NavigationIntent {
  type: 'app' | 'block' | 'board' | 'dashboard';
  slug?: string;
  appSlug?: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Context types for passing existing model state
// ---------------------------------------------------------------------------

export interface ExistingDimension {
  name: string;
  slug: string;
  members: Array<{ name: string; code: string | null }>;
}

export interface ExistingBlock {
  name: string;
  slug: string;
  blockType: string;
  formula: string | null;
  formatType: string | null;
}

export interface BlockData {
  blockName: string;
  blockType: string;
  formula: string | null;
  formatType: string | null;
  cells: Array<{
    coordinates: Record<string, string>;
    numericValue: number | null;
    textValue: string | null;
  }>;
}

export interface NavigationTarget {
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const PLATFORM_SYSTEM_PROMPT = `You are an AI assistant for an enterprise planning platform similar to Pigment or Anaplan.

## Platform Concepts

- **Blocks** are the fundamental data containers. Each block has a type:
  - \`metric\`: Calculated or input numeric values (the most common type)
  - \`dimension_list\`: A list bound to a dimension
  - \`transaction_list\`: A transactional data log
  - \`table\`: A generic tabular data container

- **Dimensions** are categorical axes that data is organized by (e.g., Time, Product, Region, Department). Each dimension contains **members** (e.g., Time dimension has members: Q1, Q2, Q3, Q4).

- **Cells** hold the actual values at the intersection of dimension members for a given block. For example, block "Revenue" at coordinates {time: "Q1", product: "Widget A"} = 50000.

- **Boards** are dashboards composed of widgets (grids, charts, KPIs, text).

## Formula DSL

Blocks can have formulas that reference other blocks by NAME. Multi-word block names are supported directly (e.g., \`Gross Profit\`).

### Operators
- Arithmetic: \`+\`, \`-\`, \`*\`, \`/\`, \`^\`
- String concatenation: \`&\`
- Comparison: \`=\`, \`!=\`, \`<\`, \`>\`, \`<=\`, \`>=\`

### Built-in Functions
- **Aggregation**: SUM(args...), AVG(args...), MIN(args...), MAX(args...), COUNT(args...)
- **Math**: ABS(x), ROUND(x, decimals), FLOOR(x), CEIL(x), POWER(base, exp), SQRT(x), LOG(x)
- **String**: CONCATENATE(args...), LEFT(str, n), RIGHT(str, n), LEN(str), UPPER(str), LOWER(str)
- **Null handling**: ISNULL(x), COALESCE(args...)
- **Conditional**: IF(condition, then_value, else_value)
- **Logical**: AND(a, b), OR(a, b), NOT(x)

### Formula Examples
- \`Revenue - COGS\` (references blocks named "Revenue" and "COGS")
- \`Gross Profit / Revenue * 100\` (computes gross margin percentage)
- \`IF(Inventory < Reorder Point, Order Quantity, 0)\`
- \`SUM(Product A Revenue, Product B Revenue, Product C Revenue)\`
- \`ROUND(Total Cost / Units Sold, 2)\`

### Important Rules
- Input blocks (where users enter data manually) have NO formula (formula is null)
- Calculated blocks reference other block names in their formulas
- Formulas are evaluated per-cell across shared dimension coordinates
- Block names in formulas are case-sensitive and must match exactly`;

// ---------------------------------------------------------------------------
// AI Service
// ---------------------------------------------------------------------------

export class AIService {
  private client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  // -------------------------------------------------------------------------
  // generateModel
  // -------------------------------------------------------------------------

  async generateModel(
    description: string,
    existingDimensions: ExistingDimension[],
    existingBlocks: ExistingBlock[],
  ): Promise<ModelPlan> {
    this.assertAvailable();

    const contextParts: string[] = [];

    if (existingDimensions.length > 0) {
      contextParts.push(
        '## Existing Dimensions\n' +
          existingDimensions
            .map(
              (d) =>
                `- **${d.name}** (slug: ${d.slug}): members = [${d.members.map((m) => m.name).join(', ')}]`,
            )
            .join('\n'),
      );
    }

    if (existingBlocks.length > 0) {
      contextParts.push(
        '## Existing Blocks\n' +
          existingBlocks
            .map(
              (b) =>
                `- **${b.name}** (slug: ${b.slug}, type: ${b.blockType})${b.formula ? `, formula: \`${b.formula}\`` : ' (input)'}`,
            )
            .join('\n'),
      );
    }

    const userMessage =
      `Generate a planning model for the following description:\n\n"${description}"\n\n` +
      (contextParts.length > 0
        ? `The application already has the following context. Avoid duplicating existing items and build on top of them where appropriate:\n\n${contextParts.join('\n\n')}\n\n`
        : '') +
      `Respond ONLY with a valid JSON object matching the ModelPlan schema below. Do not include any text outside the JSON.\n\n` +
      `Schema:\n` +
      `{\n` +
      `  "description": "string - brief description of the generated model",\n` +
      `  "dimensions": [\n` +
      `    {\n` +
      `      "name": "string",\n` +
      `      "slug": "string (lowercase, hyphens, no spaces)",\n` +
      `      "members": [{ "name": "string", "code": "string (short uppercase code)" }]\n` +
      `    }\n` +
      `  ],\n` +
      `  "blocks": [\n` +
      `    {\n` +
      `      "name": "string",\n` +
      `      "slug": "string (lowercase, hyphens, no spaces)",\n` +
      `      "blockType": "metric | dimension_list | transaction_list | table",\n` +
      `      "description": "string",\n` +
      `      "formula": "string | null (null for input blocks)",\n` +
      `      "formatType": "number | currency | percentage",\n` +
      `      "dimensionSlugs": ["string - slugs of dimensions this block uses"]\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `Guidelines:\n` +
      `- Create input blocks first (formula: null), then calculated blocks that reference them\n` +
      `- Use the formula DSL described in the system prompt\n` +
      `- Block slugs must be lowercase with hyphens (e.g., "gross-profit")\n` +
      `- Dimension slugs must be lowercase with hyphens (e.g., "time-period")\n` +
      `- Assign appropriate dimensions to each block\n` +
      `- Use "currency" formatType for monetary values, "percentage" for ratios, "number" for counts`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PLATFORM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = this.extractText(response);
    return this.parseJSON<ModelPlan>(text);
  }

  // -------------------------------------------------------------------------
  // analyzeData
  // -------------------------------------------------------------------------

  async analyzeData(
    question: string,
    blockData: BlockData[],
    dimensionContext: ExistingDimension[],
  ): Promise<AnalysisResult> {
    this.assertAvailable();

    const dataDescription = blockData
      .map((bd) => {
        const cellSummary =
          bd.cells.length > 0
            ? bd.cells
                .slice(0, 50) // cap to avoid token explosion
                .map((c) => {
                  const coordStr = Object.entries(c.coordinates)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                  const val = c.numericValue ?? c.textValue ?? 'null';
                  return `  [${coordStr}] = ${val}`;
                })
                .join('\n')
            : '  (no data)';
        return `### ${bd.blockName} (${bd.blockType}, format: ${bd.formatType ?? 'number'}${bd.formula ? `, formula: \`${bd.formula}\`` : ' (input)'})\n${cellSummary}`;
      })
      .join('\n\n');

    const dimDescription = dimensionContext
      .map(
        (d) =>
          `- **${d.name}**: [${d.members.map((m) => m.name).join(', ')}]`,
      )
      .join('\n');

    const userMessage =
      `## Data Context\n\n### Dimensions\n${dimDescription}\n\n### Block Data\n${dataDescription}\n\n` +
      `## Question\n${question}\n\n` +
      `Respond ONLY with a valid JSON object matching the AnalysisResult schema:\n` +
      `{\n` +
      `  "answer": "string - detailed textual answer to the question",\n` +
      `  "chartConfig": {\n` +
      `    "type": "bar | line | pie | area",\n` +
      `    "title": "string",\n` +
      `    "data": [{ "label": "string", "value": number, ... }],\n` +
      `    "xKey": "string - key for x-axis in data objects",\n` +
      `    "yKeys": ["string - keys for y-axis values"]\n` +
      `  },\n` +
      `  "highlights": [\n` +
      `    { "metric": "string", "value": number, "insight": "string" }\n` +
      `  ]\n` +
      `}\n\n` +
      `- "chartConfig" and "highlights" are optional — include them only when they add value\n` +
      `- If suggesting a chart, ensure "data" contains actual computed values from the data provided\n` +
      `- Highlights should call out notable trends, outliers, or key takeaways`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: PLATFORM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = this.extractText(response);
    return this.parseJSON<AnalysisResult>(text);
  }

  // -------------------------------------------------------------------------
  // suggestFormula
  // -------------------------------------------------------------------------

  async suggestFormula(
    blockName: string,
    description: string,
    availableBlocks: ExistingBlock[],
  ): Promise<string> {
    this.assertAvailable();

    const blockList = availableBlocks
      .map(
        (b) =>
          `- **${b.name}** (${b.blockType}, format: ${b.formatType ?? 'number'})${b.formula ? ` — formula: \`${b.formula}\`` : ' (input)'}`,
      )
      .join('\n');

    const userMessage =
      `I need a formula for a block named "${blockName}".\n\n` +
      `Description of what it should calculate: ${description}\n\n` +
      `Available blocks that can be referenced in the formula:\n${blockList}\n\n` +
      `Respond ONLY with the raw formula string. No explanation, no quotes, no markdown — just the formula.\n` +
      `The formula must use the DSL described in the system prompt and reference block names exactly as listed above.`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: PLATFORM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    return this.extractText(response).trim();
  }

  // -------------------------------------------------------------------------
  // parseNavigationIntent
  // -------------------------------------------------------------------------

  async parseNavigationIntent(
    query: string,
    availableApps: NavigationTarget[],
    availableBlocks: Array<NavigationTarget & { appSlug: string }>,
    availableBoards: Array<NavigationTarget & { appSlug: string }>,
  ): Promise<NavigationIntent> {
    this.assertAvailable();

    const appList =
      availableApps.length > 0
        ? availableApps.map((a) => `  - "${a.name}" (slug: ${a.slug})`).join('\n')
        : '  (none)';

    const blockList =
      availableBlocks.length > 0
        ? availableBlocks
            .map((b) => `  - "${b.name}" (slug: ${b.slug}, app: ${b.appSlug})`)
            .join('\n')
        : '  (none)';

    const boardList =
      availableBoards.length > 0
        ? availableBoards
            .map((b) => `  - "${b.name}" (slug: ${b.slug}, app: ${b.appSlug})`)
            .join('\n')
        : '  (none)';

    const userMessage =
      `Parse the following user navigation query and determine where they want to go.\n\n` +
      `Query: "${query}"\n\n` +
      `Available targets:\n` +
      `Apps:\n${appList}\n` +
      `Blocks:\n${blockList}\n` +
      `Boards:\n${boardList}\n\n` +
      `Respond ONLY with a valid JSON object:\n` +
      `{\n` +
      `  "type": "app | block | board | dashboard",\n` +
      `  "slug": "string | undefined - the slug of the matched target",\n` +
      `  "appSlug": "string | undefined - the app slug if type is block or board",\n` +
      `  "confidence": number between 0 and 1\n` +
      `}\n\n` +
      `- Use "dashboard" if the user asks for a general overview or home page\n` +
      `- Set confidence based on how closely the query matches a target\n` +
      `- If no match found, return type "dashboard" with confidence 0.3`;

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: PLATFORM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = this.extractText(response);
    return this.parseJSON<NavigationIntent>(text);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private assertAvailable(): void {
    if (!this.client) {
      throw new AIServiceUnavailableError();
    }
  }

  private extractText(response: Anthropic.Messages.Message): string {
    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('AI response contained no text content');
    }
    return textBlock.text;
  }

  private parseJSON<T>(text: string): T {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${cleaned.slice(0, 200)}`);
    }
  }
}

export class AIServiceUnavailableError extends Error {
  constructor() {
    super('AI service is not available. Set ANTHROPIC_API_KEY environment variable.');
    this.name = 'AIServiceUnavailableError';
  }
}
