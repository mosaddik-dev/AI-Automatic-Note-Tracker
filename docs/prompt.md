হ্যাঁ, তাহলে এটা **সবকিছুর একদম শুরুতেই** দিতে হবে—Claude যেন প্রথমে model folder inspect করে, সেখানে থাকা app থেকে **শুধু speech-to-text model + model চালানোর জন্য একান্ত প্রয়োজনীয় dependency/source** আলাদা করে current extension project-এ নিয়ে আসে। পুরো existing app যেন copy না করে।

আগের prompt-এর একদম শেষে নয়, **Development Workflow-এর শুরুতে** এই section বসানো ভালো:

```text
==================================================
0. FIRST STEP — EXTRACT THE LOCAL STT MODEL
==================================================

IMPORTANT:

Before doing ANY other implementation work, you must first inspect and extract the local Bengali speech-to-text model from the provided model application.

The model is currently inside a folder that contains a working application built around the model.

I do NOT want the entire existing application copied into this Chrome/Brave extension.

Your first task is ONLY to identify and extract the actual speech-to-text model and everything strictly required to run that model.

LOCAL MODEL SOURCE:

/stt-engine

Example:

/path/to/my/local-stt-app

--------------------------------------------------
WHAT YOU MUST DO FIRST
--------------------------------------------------

Before creating the extension architecture or implementing other features:

1. Inspect the entire provided local model application.
2. Understand how the existing application loads and runs the speech-to-text model.
3. Identify the actual model files/weights.
4. Identify the inference/runtime code required to execute the model.
5. Identify only the dependencies required by the model runtime.
6. Identify any tokenizer, vocabulary, configuration, processor, preprocessing, postprocessing, or supporting files required by the model.
7. Determine whether the model uses:
   - JavaScript
   - TypeScript
   - WebAssembly
   - WebGPU
   - ONNX
   - Transformers.js
   - Python
   - another runtime
   - or a combination of these.
8. Determine exactly which files belong to the model and which files belong only to the existing application UI/business logic.

--------------------------------------------------
DO NOT COPY THE EXISTING APP
--------------------------------------------------

The existing folder contains an application built around the model.

Do NOT simply copy the entire application into this project.

Do NOT bring over unnecessary:

- UI components
- pages
- routes
- styling
- unrelated business logic
- application-specific state
- unrelated API integrations
- unnecessary dependencies
- development-only code
- unrelated configuration

Instead, isolate the reusable speech-to-text/model layer.

The target should conceptually look like:

Existing Local STT App
│
├── UI                  ← DO NOT COPY
├── App Logic           ← DO NOT COPY
├── Styling             ← DO NOT COPY
├── Unrelated Features  ← DO NOT COPY
│
└── Speech-to-Text Model
    ├── Model files
    ├── Runtime
    ├── Tokenizer
    ├── Configuration
    ├── Pre/Post-processing
    └── Required dependencies
                         ↓
                  EXTRACT THESE
                         ↓
              Chrome/Brave Extension
```

---

## CREATE A CLEAN MODEL MODULE

After identifying the required model files, create a clean isolated module inside the extension project.

For example:

src/
└── services/
└── transcription/
├── LocalBengaliSTT.ts
├── model/
├── tokenizer/
├── runtime/
└── types.ts

The exact structure may be different if your analysis suggests a better architecture.

The important requirement is:

The model must be isolated from the rest of the application.

The rest of the extension should communicate with it through a clean interface.

For example:

interface TranscriptionProvider {
transcribe(audio: AudioChunk): Promise<TranscriptSegment>;
}

Then:

LocalBengaliSTT
implements TranscriptionProvider

---

## VERIFY THE EXTRACTED MODEL BEFORE CONTINUING

After extracting the model:

1. Run the model independently.
2. Verify that it loads successfully.
3. Provide it with a small Bengali audio sample if available.
4. Verify that it produces Bengali text.
5. Confirm the extracted model behaves consistently with the original application.
6. Resolve any missing dependency/path/runtime issues.

Do NOT continue to the main extension implementation until you have verified that the extracted model can actually run in the target architecture.

If the model cannot run directly inside Chrome/Brave:

STOP and investigate the reason before proceeding.

Determine whether the problem is caused by:

- unsupported runtime
- Node-only dependency
- Python dependency
- native binary dependency
- WebAssembly requirements
- WebGPU requirements
- model size
- filesystem requirements
- browser security restrictions
- extension service-worker restrictions
- memory limitations
- another technical limitation

Then choose the best practical architecture.

Do not create a fake browser implementation.

---

## PRESERVE MODEL INTEGRITY

Do not rewrite or modify the model unnecessarily.

Preserve:

- model weights
- tokenizer
- configuration
- inference behavior
- preprocessing
- postprocessing
- licensing information

Only adapt the integration layer when required by the browser-extension environment.

If the original application contains a wrapper around the model, reuse the relevant model/inference logic rather than unnecessarily rebuilding it from scratch.

---

## MODEL EXTRACTION GIT COMMIT

Once the model has been successfully isolated and verified:

Create the first logical Git commit.

Example:

feat: integrate local Bengali speech-to-text model

This should be a dedicated commit containing only the model extraction/integration work.

Do NOT mix unrelated extension features into this first commit.

Only after this model extraction/integration step is complete should you begin implementing the rest of the extension.

==================================================
THEN START THE MAIN IMPLEMENTATION
==================================

After the local STT model has been successfully extracted, integrated, and verified, proceed with the rest of the project requirements.

The implementation order should then generally be:

1. Local STT model integration
2. Manifest V3 extension foundation
3. Tab audio capture
4. Audio → local STT pipeline
5. Transcript session management
6. Persistent storage
7. AI provider abstraction
8. Google provider
9. Groq provider
10. OpenRouter provider
11. Automatic fallback system
12. AI note generation
13. Notion-ready output
14. Intelligent screenshot detection
15. Screenshot storage/association
16. Dashboard/session history
17. Settings
18. Testing
19. Full end-to-end QA
20. Final QA agent review
21. Fix remaining issues
22. Final verification and commits

If the actual technical dependencies require a different order, use the technically correct order and explain why.

```

```
