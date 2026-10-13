/**
 * Micro-frontends and MVC both organise a user interface, but they cut it along different
 * lines. MVC separates the roles inside one app (state, presentation, input); micro-frontends
 * separate a page into parts that different teams own and release. Every claim below was
 * checked against `src/architectures/both/micro-frontends` and `src/architectures/oo/mvc`
 * (index.ts and all four language examples), not against the architectures in the abstract.
 * Two caveats keep this honest. The Micro-frontends example composes on the server, while many
 * real systems compose in the browser. And the MVC example is the desktop-style pattern with a
 * live Observer link, which is not what most web "MVC" frameworks do.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "micro-frontends-vs-mvc",
  title: "Micro-frontends vs a single MVC frontend",
  order: 10,
  summary:
    "One frontend app split into Model, View and Controller, or one page composed from fragments that different teams own and release on their own?",
  subjects: [
    { kind: "architecture", slug: "micro-frontends" },
    { kind: "architecture", slug: "mvc" },
  ],
  problem:
    "A product page has several parts: the product name, a buy box and a list of recommendations. Several teams want to change their part, and the question is where to draw the line: inside one frontend app that is organised into Models, Views and Controllers, or between parts of the page that separate teams own, release and can have fail without taking the rest of the page down.",
  constraints: [
    "Do several teams need to release their part of the page on their own schedule, or can the whole frontend ship together?",
    "If one part of the page fails, must the rest of the page still be served?",
    "Do the parts of the page need to share state, navigation and one design, or are they genuinely independent?",
    "Can you pay for the extra moving parts: separately released fragments, a shell to compose them, and agreement on shared libraries and look and feel?",
    "How many people work on the frontend: one team that can coordinate, or several that keep blocking each other?",
  ],
  dimensions: [
    {
      label: "What it divides",
      values: {
        "micro-frontends":
          "The page, by owner. In the example the Product team owns the product fragment, the Checkout team the buy box, the Inspire team the recommendations and a platform team the shell.",
        mvc: "One app, by role. TodoModel holds the state, TodoListView and RemainingCountView show it, and TodoController handles input.",
      },
    },
    {
      label: "Unit of release",
      values: {
        "micro-frontends":
          "One team's fragment. The Checkout team deploys buy-box v2 and the registry prints '[registry] checkout deployed buy-box v2'. The other fragments and the shell are not redeployed. (This example runs in one process; it simulates the release.)",
        mvc: "MVC does not decide how the app is released. In the example the Model, both Views and the Controller are one program, so they ship together.",
      },
    },
    {
      label: "Failure isolation",
      values: {
        "micro-frontends":
          "The shell contains a failing fragment. When the recommendation service goes down, the Inspire fragment fails, the shell puts '<!-- inspire unavailable -->' in its slot, and the product name and the buy box are still served.",
        mvc: "Not part of the pattern. In the example the Model's notification loop simply calls update on each View, with no error handling around it, so the example does not show how a failing View would be contained.",
      },
    },
    {
      label: "Shared state between parts",
      values: {
        "micro-frontends":
          "None in the example. The fragments share no model and observe nothing: each fetches what it needs when it renders, from a service or, for the buy box, from the Checkout web BFF. Features that span fragments need agreement between teams.",
        mvc: "The point of the Model. TodoListView and RemainingCountView observe one TodoModel, so both are told about every change and cannot disagree about the data.",
      },
    },
    {
      label: "Consistency and duplication",
      values: {
        "micro-frontends":
          "Has to be arranged. Fragments built by different teams need a shared design language, shared libraries and agreed behaviour for navigation, or the page feels stitched together and libraries are duplicated. The example has none of that because its fragments return HTML strings.",
        mvc: "Comes with one codebase: the views are written against the same Model and sit in one app, so there is one place to keep their look and behaviour in step.",
      },
    },
    {
      label: "Where the parts are put together",
      values: {
        "micro-frontends":
          "In a shell. This example composes on the server, like Server-Side Includes or Edge-Side Includes; many real systems compose in the browser instead (for example with Module Federation, Web Components, single-spa or iframes).",
        mvc: "In the app. The example follows the desktop form of MVC, where the Model notifies its Views directly. Most web MVC frameworks work differently: the Controller builds a page per request, with no live Observer link.",
      },
    },
    {
      label: "Cost of the structure",
      values: {
        "micro-frontends":
          "More moving parts: separately released fragments, a shell and a registry, and a backend-for-frontend wherever a team wants one (in the example only the Checkout team has a web BFF; the other fragments call the shared services directly).",
        mvc: "Little for the example's size, but the three-way split is ceremony for a trivial screen, and nothing stops a View from reaching into the Model, so the separation is a convention.",
      },
    },
  ],
  options: [
    {
      subject: "micro-frontends",
      changes:
        "The page is cut along team lines. The Shell walks its template of slots, asks each team's current fragment to render and joins the results. The Checkout team can replace its fragment with a new version without touching the others, and the shell catches a fragment that fails and puts a comment in its slot, so the rest of the page is still served.",
      chooseWhen: [
        "Several teams work on one page, and one shared frontend release has become the bottleneck: each team wants to ship its part when it is ready.",
        "The page splits into parts with clear owners that do not need to know each other's internals.",
        "One part of the page failing should not stop the rest of it from being served.",
        "You can afford the cost: a shell, a registry, a shared design language and agreed rules for navigation and shared state.",
      ],
      code: [
        { kind: "architecture", slug: "micro-frontends", region: "shell" },
        { kind: "architecture", slug: "micro-frontends", region: "checkoutTeam" },
        { kind: "architecture", slug: "micro-frontends", region: "inspireTeam" },
      ],
      steps: [
        { kind: "architecture", slug: "micro-frontends", step: 0 },
        { kind: "architecture", slug: "micro-frontends", step: 7 },
        { kind: "architecture", slug: "micro-frontends", step: 9 },
      ],
    },
    {
      subject: "mvc",
      changes:
        "One app is separated by role. TodoModel owns the state, TodoListView and RemainingCountView both observe it, and a Controller turns clicks into changes to the Model. Parts of the page share the Model, so every View is told about every change, and the whole thing is one program that is built and released together.",
      chooseWhen: [
        "One team, or teams that can release together, own the whole frontend.",
        "The same state must be shown more than one way at once, and the views have to stay in step.",
        "Input handling is complex enough that you want it separate from rendering.",
        "You do not need parts of the page to be released, or to fail, independently.",
      ],
      code: [
        { kind: "architecture", slug: "mvc", region: "model" },
        { kind: "architecture", slug: "mvc", region: "listView" },
        { kind: "architecture", slug: "mvc", region: "countView" },
      ],
      steps: [
        { kind: "architecture", slug: "mvc", step: 0 },
        { kind: "architecture", slug: "mvc", step: 5 },
      ],
    },
  ],
  noPattern: {
    when: "A single screen with one piece of state and one way to show it, built by a small team that releases together.",
    instead:
      "Write plain components in one frontend and keep the state in one place. Neither the three-way MVC split nor a shell with separately released fragments is worth it until there is a second view of the same state, or a second team that cannot wait for the first.",
  },
  overlap:
    "These are not rivals at the same level. MVC organises the inside of an app; micro-frontends divide a page between teams. A team can build the inside of its own fragment as an MVC app, though neither example shows that: the Micro-frontends example has no input handling and no observed Model, and its BuyBoxModel is only a plain data shape returned by the Checkout web BFF. Adopting micro-frontends does not replace the question of how each fragment is structured.",
  scenario: {
    prompt:
      "A team of five builds one product page. They release it together every week, and the page needs a list and a count that always show the same data. Someone proposes micro-frontends so that the team can scale. Which fits best?",
    choices: [
      {
        id: "mvc",
        option: "mvc",
        label: "A single frontend structured as MVC",
        verdict: "best",
        explanation:
          "One team that releases together has no release bottleneck for micro-frontends to remove, and the list and the count need to share state, which is what the Model and its observing Views are for. Micro-frontends would add a shell and separately released parts, and would leave that shared state to be arranged between fragments.",
      },
      {
        id: "micro-frontends",
        option: "micro-frontends",
        label: "Micro-frontends, one fragment per part of the page",
        verdict: "poor",
        explanation:
          "The benefits are independent releases and failure isolation between teams, and this team has neither problem. The costs remain: a shell and registry to run, separately released fragments, and agreement on design, libraries and shared state. The fragments in the example share no model, so the list and the count would have to be kept in step another way.",
      },
      {
        id: "no-structure",
        option: "none",
        label: "No structure: one screen class that holds state, draws and handles input",
        verdict: "workable",
        explanation:
          "For a single small screen this is the least ceremony. It stops working well when a second view of the same data arrives, which is the case here, since the list and the count both need it. Then the state logic is duplicated or one view reaches into the other.",
      },
    ],
  },
};
