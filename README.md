# Research-to-Infographic Machine

## Overview

The Research-to-Infographic Machine transforms long-form academic papers into visually structured infographics while maintaining factual alignment with the original source.

Unlike traditional summarization tools, this system prioritizes **faithfulness, transparency, and explainability** by verifying generated content against source material and surfacing evaluation results directly to the user.

---

## Key Features

* **Infographic Generation**
  Converts dense research papers into structured, readable infographic-style outputs.

* **Claim-Level Verification**
  Breaks generated content into individual claims and validates each against retrieved source evidence.

* **Retrieval-Augmented Generation (RAG)**
  Grounds outputs using relevant sections of the original document.

* **Evaluation Metrics**

  * **Accuracy (Faithfulness):** Measures factual alignment with source
  * **Coverage:** Measures how much key content is retained
  * **Integrity Risk:** Estimates likelihood of misleading or unsupported content

* **Audit Log (Explainability Layer)**
  Surfaces:

  * Missing context caveats
  * Misleading simplifications
  * Supported and/or partially supported claims

---

## System Architecture

The system follows a multi-stage pipeline:

1. **Ingestion**
   Parse uploaded PDF into structured text with page awareness.

2. **Generation**
   Produce an initial infographic-style summary using a large language model.

3. **Claim Extraction**
   Decompose the output into discrete factual claims.

4. **Retrieval (RAG)**
   Retrieve relevant sections of the source paper for each claim.

5. **Verification**
   Compare claims against source evidence and classify:

   * Supported
   * Partially Supported
   * Unsupported

6. **Scoring & Evaluation**
   Compute:

   * Accuracy score
   * Coverage score
   * Integrity risk level

7. **Rendering**
   Output:

   * Final infographic
   * Audit log with evaluation insights

---

## Evaluation Approach

We evaluate outputs at the **claim level** to ensure grounded generation.

### Metrics

| Metric         | Description                                            |
| -------------- | ------------------------------------------------------ |
| Accuracy       | Percentage of claims fully supported by source         |
| Coverage       | Degree to which key ideas from the paper are preserved |
| Integrity Risk | Risk of misleading or hallucinated content             |

### Key Insight

There is a tradeoff between:

* **Higher accuracy (strict verification)**
* **Lower coverage (loss of nuance or detail)**

Our system explicitly surfaces this tradeoff to users.

---

## Example Results

| Metric         | Value    |
| -------------- | -------- |
| Accuracy       | ~90–100% |
| Coverage       | ~60–70%  |
| Integrity Risk | Nominal  |

**Interpretation:**
Stronger verification significantly improves trust, but may reduce completeness of the final output.

---

## Tech Stack

* Google AI Studio (Gemini models)
* Retrieval-Augmented Generation (RAG)
* TypeScript (frontend / UI logic)
* HTML/SVG (for infographic rendering output)

---

## Example Pipeline Flow

```
PDF → Generate → Extract Claims → Retrieve → Verify → Score → Infographic + Audit Log
```

---

## Limitations

* May omit nuanced or low-frequency insights due to strict filtering
* Dependent on retrieval quality for grounding accuracy
* Visual infographic styling is template-based (not fully design-optimized)

---

## Future Work

* Improve coverage without sacrificing accuracy
* Add fine-tuned models for stronger editorial tone
* Expand evaluation to include human review scoring

---

## Contributors

* Kai Binatti
* Sehajbir Goraya
* Dhruv Kantamsetty
* Alexandr Kim
* Kal Melaku
* Emma Soupharath

---

## License

This project is for academic use. License can be added if extended for public or commercial use.


<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e3177f3d-1c53-4dd9-b414-fc35eecee7aa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`



