import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Clapperboard,
  FileText,
  FolderInput,
  History,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  NotebookText,
  Play,
  RotateCw,
  Shapes,
  Share2,
  SquarePen,
  Users,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// The user guide's content, rendered by `GuidePage`. Every string is inline markdown: bold names a control
// exactly as the app labels it, and code marks a key. A change to a label or flow named here updates this
// file in the same change.

export type GuideTopicId =
  | "basics"
  | "build"
  | "animate"
  | "draw"
  | "rotation"
  | "notes"
  | "share"
  | "keep"
  | "team"
  | "games"
  | "stats-basics"
  | "record"
  | "fix-stats"
  | "read-stats"
  | "highlights"
  | "report"
  | "import-sets"
  | "help";

/** The chapters, in the order the guide lists them. */
export const GUIDE_GROUPS = ["Start here", "Boards and notes", "Your team", "Stats", "Help"] as const;
export type GuideGroup = (typeof GUIDE_GROUPS)[number];

/** A short definition, shown as a card. */
export type GuideConcept = { term: string; text: string };

/** One thing the reader wants to do, as ordered steps. */
export type GuideTask = { title: string; intro?: string; steps: string[]; after?: string };

/** A lookup table: a term or key, and what it means. */
export type GuideReference = { title: string; intro?: string; keys?: boolean; rows: [string, string][] };

export type GuideTopic = {
  id: GuideTopicId;
  group: GuideGroup;
  title: string;
  icon: LucideIcon;
  /** Who the topic is for, when it is not everyone. */
  who?: string;
  intro: string;
  concepts?: GuideConcept[];
  tasks?: GuideTask[];
  references?: GuideReference[];
  tips?: string[];
  related?: GuideTopicId[];
};

export const GUIDE_LEDE =
  "VolleyVector is where you draw plays, animate them, plan your games, and record match stats from video. Pick the job you want to do.";

export const GUIDE_AI_NOTICE =
  "This guide was written by AI. If a step does not match what you see, tell us with **Report a problem…** in the account menu.";

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "basics",
    group: "Start here",
    title: "The basics",
    icon: BookOpen,
    intro: "Six ideas explain the whole app.",
    concepts: [
      {
        term: "Spaces",
        text: "Everything lives in a space. **Personal** is yours alone. Each team has its own library that its members share. Switch between them under **Spaces** in the sidebar.",
      },
      {
        term: "Boards",
        text: "A board is one court diagram. With one step it is a **Position**, a still picture. Add a second step and it becomes a **Sequence** that plays as an animation.",
      },
      {
        term: "Notes",
        text: "A note is a page of writing with boards placed in it, like a practice plan or a playbook chapter. One board can appear in any number of notes.",
      },
      {
        term: "Games and stats",
        text: "A team also has **Games**. A game holds your squad, your starting rotations, and the sets you record from the match video.",
      },
      {
        term: "Roles",
        text: "In a team, coaches create and edit, and players view. In your Personal space you can do everything.",
      },
      {
        term: "Inspiration",
        text: "**Inspiration** is a library of example boards. Open one and choose **Copy to** in its menu to get your own copy to change.",
      },
    ],
    references: [
      {
        title: "Where things are",
        rows: [
          ["Sidebar", "Your spaces, then **All Boards**, **Games** (in a team), and your notes."],
          ["Top bar", "The trail back to where you came from, and your account menu on the right."],
          ["Account menu", "**Account settings**, **Invite…**, the theme, this guide, and **Report a problem…**."],
          [
            "More actions",
            "The **⋯** button on a board, note, or library. It holds sharing, history, print, and export.",
          ],
        ],
      },
    ],
    tips: ["On a narrow screen the sidebar folds away. Open it with the button at the left of the top bar."],
    related: ["build", "stats-basics"],
  },
  {
    id: "build",
    group: "Boards and notes",
    title: "Build a board",
    icon: SquarePen,
    intro: "Start with a still picture: who stands where.",
    tasks: [
      {
        title: "Create a position",
        steps: [
          "Open **All Boards** and press **New board**. The board opens in the editor.",
          "Type a title. Press **+ Tag** to add tags, which you can filter the library by later.",
          "Press a role in the marker row to add that player, or the ball. New markers wait on the bench below the court.",
          "Drag each marker into place. For a fine move, select a marker and press the arrow keys (hold `Shift` for a bigger step).",
          "Say what the board shows under **Description**.",
          "Press **Done** to save. **Cancel** throws your changes away.",
        ],
      },
      {
        title: "Change or remove a marker",
        steps: [
          "Select the marker on the court.",
          "Change its **Role** or type a short **Label** (e.g. a jersey number).",
          "Press **Remove** to take it off the board.",
        ],
        after: "`Ctrl+Z` undoes your last change and `Ctrl+Shift+Z` brings it back.",
      },
      {
        title: "Set up the court",
        intro: "Open **Court settings**, the gear beside the court.",
        steps: [
          "**Court mode**: **Positions** offers the volleyball roles. **Basic** offers a coach and numbered players in any colour, for drills.",
          "**Opponent side**: shows the other half of the court. A switch then appears in the marker row to choose which team a new player joins.",
          "**Court grid** and **Snap to grid**: draw a grid on the court and make markers land on it.",
        ],
      },
      {
        title: "Find a board again",
        steps: [
          "Open **All Boards**.",
          "Press **Positions** or **Sequences** to show one kind.",
          "Press a tag to show only boards with it. Press more tags to narrow further.",
        ],
      },
    ],
    tips: [
      "A player stays on their own half of the court. Only the ball crosses the net.",
      "If you close the tab while editing, the app offers to restore your unsaved changes the next time you open that board to edit.",
    ],
    related: ["animate", "draw", "rotation"],
  },
  {
    id: "animate",
    group: "Boards and notes",
    title: "Animate a play",
    icon: Play,
    intro:
      "A sequence is a board with several steps. You place the players on each step and the app moves them between.",
    tasks: [
      {
        title: "Turn a board into a sequence",
        steps: [
          "Open the board and press **Edit**.",
          "Press **+ Add step**. The new step starts as a copy of the one before it.",
          "Drag the markers to where they end up. An arrow appears for every marker that moved.",
          "Write what happens in the step's instruction box.",
          "Add a step for each further move, then press **Done**.",
        ],
      },
      {
        title: "Reorder or remove steps",
        steps: [
          "Press a step number to work on that step.",
          "Drag a step number sideways to move the step.",
          "Press **Remove current step** at the end of the row to delete it.",
        ],
      },
      {
        title: "Play it",
        steps: [
          "Open the board and press **Play**.",
          "Press **Previous step** or **Next step** to go one at a time, or a step number to jump there.",
          "Read each step's instruction beside the court as it plays.",
        ],
      },
    ],
    tips: [
      "A marker is the same player on every step. Moving it changes one step. Changing its role or label changes all of them.",
      "To hide the automatic arrows, turn off **Auto arrows** in **Court settings**. Arrows you draw yourself stay.",
    ],
    related: ["build", "draw"],
  },
  {
    id: "draw",
    group: "Boards and notes",
    title: "Draw on the court",
    icon: Shapes,
    intro: "Add lines, arrows, zones, and labels on top of the players. A drawing belongs to the step you drew it on.",
    tasks: [
      {
        title: "Add a drawing",
        steps: [
          "In the editor, pick a tool from the rail beside the court, or press its key.",
          "Drag on the court to draw. For a polygon, click each corner and press `Enter` to close it.",
          "Set the **Colour**, **Width**, **Stroke**, and **Fill** in the panel beside the court. The next shape you draw takes the same style.",
        ],
      },
      {
        title: "Change a drawing",
        steps: [
          "Choose **Select drawing** and press the shape.",
          "Drag it to move it, or drag its handles to reshape it.",
          "Press `Delete` to remove it, or `Ctrl+D` to duplicate it.",
        ],
      },
    ],
    references: [
      {
        title: "Tool keys",
        keys: true,
        rows: [
          ["M", "Edit markers"],
          ["V", "Select drawing"],
          ["L", "Draw line"],
          ["A", "Draw arrow"],
          ["R", "Draw rectangle"],
          ["O", "Draw ellipse"],
          ["G", "Draw polygon"],
          ["P", "Draw freehand"],
          ["T", "Add text"],
        ],
      },
    ],
    tips: [
      "In a sequence, **Copy drawings to next step** carries the current step's shapes forward.",
      "`Esc` drops the tool you are holding and goes back to selecting.",
    ],
    related: ["build", "animate"],
  },
  {
    id: "rotation",
    group: "Boards and notes",
    title: "Check a rotation",
    icon: RotateCw,
    intro: "Show a step's rotation beside the court and let the app catch overlaps for you.",
    tasks: [
      {
        title: "Set a rotation",
        steps: [
          "Put six players on the board. The presets need a 5-1 line-up: a setter, two outsides, an opposite, and two middles (or a middle and a libero).",
          "In the editor's **Rotation** panel, choose **Rotation 1** to **Rotation 6**. The number is the position the setter is in.",
          "Arrange the players on the court. A red line joins any two players who overlap.",
          "Set **Enforcement** to **Strict** to stop a drag at the legal limit. **Loose** lets you place players anywhere and only flags the overlap.",
        ],
      },
      {
        title: "Use any other line-up",
        steps: [
          "In the **Rotation** panel, choose **Custom**.",
          "Drag each of the six players from the bench row into their zone on the small diagram.",
        ],
        after: "The rotation switches on once all six zones are filled.",
      },
    ],
    tips: [
      "The rotation is set per step, so a sequence can start in one rotation and show the switch after the serve.",
      "When viewing a board, select a player to see which neighbours limit where they may stand.",
      "The check follows the overlap rule: front players ahead of their back players, and neighbours in a row in order. Players level with each other are legal.",
    ],
    related: ["build", "games"],
  },
  {
    id: "notes",
    group: "Boards and notes",
    title: "Organise with notes",
    icon: NotebookText,
    intro: "Tags filter the library. Notes go further: they put boards in order, with your own words around them.",
    tasks: [
      {
        title: "Write a note",
        steps: [
          "Press **New note** in the sidebar, then **Edit**.",
          "Give the note a title.",
          "Press **+ Text block** to write. Press **+ Board group**, then **Pick boards**, to place boards from the library.",
          "Reorder the blocks with their arrows and press **Done**.",
        ],
      },
      {
        title: "Put a board into a note",
        intro: "There are three ways, and they all do the same thing.",
        steps: [
          "On an open board, press **Add to note** under the title and choose the note.",
          "On a note page, press **New board**. The board joins that note when you first save it.",
          "In the note editor, add it to a **Board group**.",
        ],
      },
      {
        title: "Arrange your notes",
        steps: [
          "Hover a note in the sidebar and open its menu.",
          "Choose **Move up** or **Move down** to reorder it.",
          "Choose **Nest under …** to make it a subnote, or **Move to top level** to bring it back out.",
        ],
        after: "**+ Subnote** on a note page creates a new note inside it.",
      },
    ],
    tips: [
      "A note does not hold its boards, it points to them. Deleting a note never deletes a board, and every board stays in **All Boards**.",
      "Sharing a note shares its subnotes too.",
    ],
    related: ["share", "keep"],
  },
  {
    id: "share",
    group: "Boards and notes",
    title: "Share boards and notes",
    icon: Share2,
    intro: "A board in a team library is already shared with that team. Everything else you share yourself.",
    tasks: [
      {
        title: "Give someone access",
        steps: [
          "Open the board or note, press **More actions**, and choose **Manage access…**.",
          "Pick a teammate or a team, choose the level, and press **Add**.",
          "To change a level later, change it in the list. Press the remove button on a row to take access away.",
        ],
      },
      {
        title: "Share with someone outside your teams",
        steps: [
          "In **Manage access…**, go to **Share outside your teams** and choose the **Access level**.",
          "Enter their email and press **Share**. They need an account with that address.",
          "Or press **Copy share link** and send it. The link works once, for the first signed-in person who opens it.",
        ],
      },
      {
        title: "Send a link anyone can open",
        steps: [
          "Open the board, press **More actions**, and choose **Manage access…**.",
          "Press **Copy view-only link** and send it. The reader needs no account.",
        ],
        after:
          "The link opens once the board is shared with a team or another person. A board only you can see stays private.",
      },
      {
        title: "Make your own copy",
        steps: [
          "Open the board and press **More actions**.",
          "Under **Copy to**, choose a space. **Duplicate** makes a copy in the space you are in.",
        ],
        after: "A copy is separate. Later changes to the original do not reach it.",
      },
    ],
    references: [
      {
        title: "Access levels",
        rows: [
          ["Viewer", "Can open it and play it."],
          ["Editor", "Can also change it."],
          ["Owner", "Can also share it and delete it. You own what you create."],
        ],
      },
    ],
    tips: [
      "Sharing with a team puts the board in that team's library. Its coaches get the level you chose, and its players can view.",
      "Editors take turns. If someone saved while you were editing, the app asks before you **Overwrite** their version.",
      "Deleting a board that others also hold only removes it from your side. They keep it.",
    ],
    related: ["keep", "team"],
  },
  {
    id: "keep",
    group: "Boards and notes",
    title: "History, print, and export",
    icon: History,
    intro: "Every save is kept. You can go back, put a board on paper, or take your work out as a file.",
    tasks: [
      {
        title: "Go back to an earlier version",
        steps: [
          "Open the board or note, press **More actions**, and choose **History…**.",
          "Press a version to preview it.",
          "Press **Restore this version**.",
        ],
        after: "Restoring adds a new version on top. Nothing in the history is lost.",
      },
      {
        title: "Print a handout",
        steps: [
          "Open the board or note, press **More actions**, and choose **Print…**.",
          "Print the page from your browser, or save it as a PDF.",
        ],
        after: "A sequence prints every step with its arrows and instruction. A note prints its text and its boards.",
      },
      {
        title: "Export and import",
        steps: [
          "Press **More actions** on a board, a note, or the library, and choose **Copy JSON** or **Download JSON**.",
          "To bring a file in, open the library's **More actions** menu and choose **Import JSON…**.",
          "Check the preview and confirm. Nothing is added before you do.",
        ],
        after:
          "A note's export carries its subnotes and every board they use. The library's export carries the whole space.",
      },
    ],
    tips: [
      "**Replace from JSON…** in a board's menu swaps that board's content for a file's, and keeps who it is shared with.",
    ],
    related: ["share", "help"],
  },
  {
    id: "team",
    group: "Your team",
    title: "Set up a team",
    icon: Users,
    who: "Coaches",
    intro: "A team gives your players one shared library, a roster, and games.",
    tasks: [
      {
        title: "Create a team",
        steps: [
          "Under **Spaces** in the sidebar, press **New team**.",
          "Name it and press **Create team**. You are its coach.",
        ],
      },
      {
        title: "Invite people",
        steps: [
          "Press the gear on the team's row to open the team page. On a small screen, choose **Manage team…** in the library's **More actions** menu.",
          "Press **Invite member** and choose the **Role**: **Coach** or **Player**.",
          "**By link**: press **Create invite link** and send the link however you like.",
          "**By email**: enter the address and press **Send invite**.",
        ],
        after:
          "Raise **Uses** to bring in a whole squad with one link. A link expires after 7 days. Someone who already has an account joins in one click.",
      },
      {
        title: "Add your roster",
        steps: [
          "On the team page, press **Add player**.",
          "Enter the **Number**, **Name**, and **Main position**. **Short name** is what the rotation slips print. **Also plays** lists other positions the player can take.",
          "To add everyone at once, press **Import…** and paste one player per line.",
        ],
        after:
          "A line reads number, name, short name, main position, other positions (e.g. `7,Lena Vogt,Lena,S,OPP/OH`).",
      },
    ],
    tips: [
      "The roster is the list of players you pick for games and record stats for. A player on it does not need an account.",
      "Removing a player from the roster keeps them in the games and sets they already played.",
      "Removing a member from the team takes away their access. What they created stays.",
    ],
    related: ["games", "share"],
  },
  {
    id: "games",
    group: "Your team",
    title: "Plan a game",
    icon: ClipboardList,
    who: "Coaches",
    intro: "Pick your squad, set your starting rotations, and print the slips for the scorer's table.",
    tasks: [
      {
        title: "Create the game",
        steps: [
          "Open your team, press **Games** in the sidebar, then **New game**.",
          "Type a name at the top, and fill in the **Date**, **Opponent**, and **Venue**. The game saves as you type.",
          "On the **Overview** tab, press **Pick squad** and tick who plays.",
        ],
        after:
          "In **Pick squad**, press the pencil on a player to change their number or position for this game only. The roster stays as it is. To change the date or opponent later, press **Edit details**.",
      },
      {
        title: "Set a starting rotation",
        steps: [
          "Open the game's **Rotations** tab and press **Add rotation**. The app fills in a 5-1 from each player's main position.",
          "Press any zone to change who stands there. Players who fit the zone are listed first. Picking someone already on court swaps the two.",
          "Press the bar under the court to choose the libero.",
          "Press the arrows beside the stamp to rotate the whole line-up.",
          "Press **Add planned sub** to note who may come on for whom, and write your plan under **Notes**.",
        ],
        after: "Turn off **5-1 suggestions** to see every player for every zone.",
      },
      {
        title: "Print the slips",
        steps: [
          "Under **Print versions**, choose which rotations of the line-up to print (e.g. the one you serve in and the one you receive in).",
          "Press **Print slips**.",
          "Switch the squad list and the overview on or off at the top, then print from your browser.",
        ],
      },
    ],
    tips: [
      "The **Overview** shows where every squad player belongs in a 5-1, so anyone can check their spot.",
      "Players see the same game page and can rotate the slips to look, but cannot change them.",
      "A game with no opponent works as a place to keep a line-up idea.",
    ],
    related: ["team", "record"],
  },
  {
    id: "stats-basics",
    group: "Stats",
    title: "How stats work",
    icon: Lightbulb,
    intro: "You record what your own players do with the ball. The app works out everything else.",
    concepts: [
      {
        term: "One touch at a time",
        text: "Each time one of your players touches the ball you record four things: the player, the skill, the result, and the zone. The opponent's touches are not recorded.",
      },
      {
        term: "The score keeps itself",
        text: "A rally ends when a touch decides it, like a kill or a serve into the net. If no touch decided it, the app reads the winner from who serves next. You rarely enter a point by hand.",
      },
      {
        term: "Everything points at the video",
        text: "Every touch carries its time in the match video. That is how you get from any number in the stats to the clip behind it.",
      },
      {
        term: "Sets belong to a game",
        text: "You record one set at a time, inside a game. The game's stats add its sets together, and you can add several games together too.",
      },
      {
        term: "Who does what",
        text: "Coaches record. Every member of the team can open the stats, the highlights, and the match report.",
      },
      {
        term: "Your work saves itself",
        text: "What you record is stored a moment after every change. Offline, it stays in your browser and is stored when the connection returns.",
      },
      {
        term: "The team sees it when you say so",
        text: "The stats everyone reads change only when you press **Save stats** in the tracker, or mark the set finished. A half-recorded set never shows up in the stats by accident.",
      },
    ],
    tips: [
      "Record from a YouTube video if you can. Highlights and the video links in the report only work with YouTube.",
      "Set the starting line-up before you record. Playing time, plus/minus, and the server suggestion all depend on it.",
    ],
    related: ["record", "read-stats"],
  },
  {
    id: "record",
    group: "Stats",
    title: "Record a set",
    icon: Video,
    who: "Coaches",
    intro: "Watch the video and tag each touch from the keyboard: who, what, how it went, and where.",
    tasks: [
      {
        title: "Set up the set",
        steps: [
          "Open the game. On its **Overview** tab press **Add set**, then **Record stats** on the new row.",
          "Load the video: paste a YouTube link and press **Load**, or press **Load local video** for a file on your computer.",
          "Open **Players**. The list starts as the game's squad. The first ten players get the keys `1` to `9` and `0`, in list order, so move your regulars to the front.",
          "Press **Set lineup** and choose who starts in positions 1 to 6, and the **Libero**. Position 1 serves.",
          "On the scoreboard, set **Start rotation**. Leave **First serve** on **Auto-detect** unless you want to fix it.",
        ],
        after: "**First serve** and **Start rotation** can only be changed before the first stat.",
      },
      {
        title: "Record a rally",
        intro: "Mark the touches while the rally runs, then describe them once it is over.",
        steps: [
          "Press `Space` to play the video.",
          "Press `Tab` each time one of your players touches the ball. The video keeps playing.",
          "When the rally ends, press `Enter`. The video jumps back to your first mark.",
          "Describe the touch: the player's number, the skill's letter, the result's number, then the zone's number.",
          "The touch saves when the zone is set, and the next mark opens. After the last one the video carries on where you stopped.",
        ],
        after:
          "The app fills in the likely player and skill, so often you only press the result and the zone. Press another letter to change the skill, or `Shift` and a number to change the player.",
      },
      {
        title: "Fix a slip while you describe",
        steps: [
          "Press `Backspace` to take back your last choice.",
          "Press `Esc` to skip a mark, for a tap by mistake or a touch that was not yours.",
          "Press **Stop** to drop the marks that are left.",
        ],
      },
      {
        title: "Record one touch at a time",
        intro: "If you would rather stop at every touch, skip the marks.",
        steps: [
          "At the touch, press `Enter`, or go straight to the player's number or the skill's letter. The video pauses.",
          "Finish the touch. The video plays on by itself.",
        ],
      },
      {
        title: "Give a point by hand",
        intro:
          "You need this for the last rally of a set, and when you want the reason on record for a ball none of your players touched.",
        steps: [
          "Press `+` for a point to you, or `-` for a point to the opponent.",
          "Press a number for the reason (e.g. **Opp serve error**), or carry on to leave it out.",
        ],
        after:
          "If one of your players touched the ball last, record that touch instead (e.g. **Defense**, then **Error**).",
      },
      {
        title: "Make a substitution",
        steps: ["Under **On court**, press the player who comes off.", "Press the player who comes on."],
        after: "To change who started the set, press **Edit starting lineup** instead.",
      },
      {
        title: "Finish the set",
        steps: [
          "Give the last point by hand if no touch decided it.",
          "Under **Set**, press **Mark set finished**. This also saves the stats for the team.",
          "Press **Next set** to start the next one with the same players, line-up, and video.",
        ],
        after:
          "Not done yet but want the team to see what you have? Press **Save stats** at the top of the tracker. It reads **Stats saved** when they are up to date.",
      },
    ],
    references: [
      {
        title: "Skill keys",
        keys: true,
        rows: [
          ["S", "Serve"],
          ["R", "Receive"],
          ["E", "Set"],
          ["A", "Attack"],
          ["B", "Block"],
          ["D", "Defense"],
          ["F", "Freeball"],
          ["M", "Misc, a note in your own words"],
        ],
      },
      {
        title: "What the results mean",
        intro: "Each skill has its own results, numbered on screen. Hover one to see what it means.",
        rows: [
          ["Dig 0-1", "The pass left one attacking option, or none. On a serve or freeball it is the opponent's pass."],
          ["Dig 2-3", "The pass left two attacking options, or all three."],
          ["On, Off", "A set you can attack, or one that is hard to attack."],
          ["Over (pt), Over (def)", "The setter sent the ball over. It scored, or it was defended."],
          ["Block tool", "Your attack scored off their block."],
          ["Blocked, in play", "Their block touched your attack and the rally went on."],
          ["Blocked, kill", "Their block scored."],
          ["Tooled", "Their attack scored off your block."],
          ["Out, Net", "The rally is lost. These skip the zone."],
        ],
      },
      {
        title: "What the zone means",
        intro:
          "Zones are numbered as you see the court from behind your own baseline: 4, 3, 2 at the net, 7, 8, 9 in the middle, 5, 6, 1 at the back. Zone 0 is an error.",
        rows: [
          ["Serve, Attack, Freeball", "Where the ball went."],
          ["Receive, Defense", "Where your player played it from."],
          ["Set", "Who was set: 1 back row, 2 opposite, 3 middle, 4 outside, 5 libero, 6 pipe."],
          ["Block", "Usually 0. You may record where the attack came from."],
        ],
      },
      {
        title: "Video keys",
        keys: true,
        rows: [
          ["Space", "Play or pause"],
          ["← →", "Back or forward 2 seconds (5 with Shift)"],
          [", .", "One frame back or forward"],
          ["[ ]", "Slower or faster"],
          ["Ctrl+Z", "Undo (add Shift to redo)"],
        ],
      },
    ],
    tips: [
      "A sideways or distant video? Use the rotate and zoom buttons under it.",
      "Every key is also listed under **Keyboard shortcuts** at the bottom of the tracker.",
      "You can click everything instead of using keys. It is slower, but works without a keyboard.",
    ],
    related: ["fix-stats", "read-stats", "stats-basics"],
  },
  {
    id: "fix-stats",
    group: "Stats",
    title: "Check and fix a set",
    icon: ListChecks,
    who: "Coaches",
    intro: "Everything you recorded is listed under the video, rally by rally, and all of it can be corrected.",
    tasks: [
      {
        title: "Correct a touch",
        steps: [
          "Find it in **Recorded stats**. The newest rally is at the top.",
          "Press its time to jump the video to that moment.",
          "Press the pencil, change what is wrong, and press `Enter`.",
        ],
        after: "The bin deletes a touch. `Ctrl+Z` undoes your last change, whatever it was.",
      },
      {
        title: "Say why a rally ended",
        intro: "A rally marked as inferred was decided by who served next, not by a touch.",
        steps: [
          "Find the line that reads **inferred from who served next**.",
          "Choose a reason under **Why?** (e.g. **Opp attack error**).",
        ],
        after: "The reason feeds **Point breakdown** in the stats. Without it the point counts as **Not recorded**.",
      },
      {
        title: "Type in a score",
        intro: "For a set you did not record, or one whose recording is incomplete.",
        steps: ["On the game's **Overview** tab, press the set's score.", "Type both scores and confirm."],
        after:
          "A typed-in score counts for the game's result. A set with only a typed-in score has no stats, so the stats pages leave it out.",
      },
      {
        title: "Back up or move a set",
        steps: [
          "Under **Set**, press **Export JSON** to download the whole set, or **Export CSV** for a spreadsheet.",
          "Press **Import JSON** to replace this set's stats with a file.",
        ],
      },
    ],
    references: [
      {
        title: "Messages in the log",
        rows: [
          ["We were serving but no serve is recorded", "A serve is missing. Go to the rally in the video and add it."],
          [
            "Won a rally none of our players touched",
            "The serve changed sides with no touch of yours between, usually an opponent serve error.",
          ],
          [
            "Not added: rally … already ended",
            "You gave a point by hand right after a touch that had already ended the rally.",
          ],
        ],
      },
      {
        title: "The save status",
        intro: "It sits at the top of the tracker.",
        rows: [
          ["Saved", "Your recording is stored."],
          ["Save stats", "You have changes the team's stats do not show yet. Press it to publish them."],
          ["Stats saved", "The team's stats match what you recorded."],
          [
            "Offline: kept in this browser, retrying",
            "Keep recording. It saves when the connection returns. Use the same browser until it does.",
          ],
          ["Signed out: kept in this browser", "Press **Sign in**. Saving picks up where it stopped."],
          [
            "Not saved: changed elsewhere",
            "Someone saved this set after you opened it. **Keep theirs (reload)** drops your unsaved changes. **Keep mine (overwrite)** replaces theirs.",
          ],
        ],
      },
    ],
    tips: [
      "If a set changed in two places while you were away, the app asks which to keep and downloads the other as a file first.",
      "Deleting a set cannot be undone, so the app downloads it as a file as it goes, unless you untick that.",
      "On the game page, **Stats not saved** or **Stats not up to date** on a set means it has changes the stats do not show. Open it and press **Save stats**.",
      "**Reopen set** takes a finished set back to unfinished.",
    ],
    related: ["record", "import-sets"],
  },
  {
    id: "read-stats",
    group: "Stats",
    title: "Read the stats",
    icon: BarChart3,
    intro:
      "The **Stats** tab turns your recorded sets into one page: the match, each skill, each player, and every rally.",
    tasks: [
      {
        title: "Open the stats",
        steps: [
          "For one game, open it and press its **Stats** tab.",
          "For several games, open **Games**, tick the box in front of each, and press **Stats for 2 games**. Only games with saved stats can be ticked.",
          "While recording, press **Stats and highlights for this set** under **Set**.",
        ],
      },
      {
        title: "Narrow what you see",
        steps: [
          "Press a set at the top to see that set alone. **All sets** brings the match back.",
          "Choose a **Player**, or press a name under **Player metrics**, to see one player's metrics and zones.",
        ],
      },
      {
        title: "Go from a number to the video",
        steps: [
          "Press any bar, zone, or cell. A box shows what is behind it.",
          "Press the **clips** button in that box.",
          "The **Highlights** tab opens and plays exactly those moments.",
        ],
      },
      {
        title: "Send the stats to someone",
        steps: [
          "Set the page the way you want it read.",
          "Press **HTML** for one file that opens in any browser, also offline.",
          "Or press **PDF** and save from the print window.",
        ],
        after: "Both keep the set, player, and filters you chose.",
      },
    ],
    references: [
      {
        title: "What each card shows",
        rows: [
          ["Set scores", "Each set's score and result. A set's name opens its video."],
          [
            "Point breakdown",
            "How the points were won: yours on the right, the opponent's on the left. **Not recorded** counts rallies with no reason given.",
          ],
          [
            "Rotations",
            "The share of rallies you won in each rotation. **Side-out** is when you receive, **Break point** when you serve. R1 means the setter is in position 1.",
          ],
          [
            "Momentum",
            "How often you won the next rally after a run of won or lost rallies, against your average. The bar at the bottom says whether runs made a real difference.",
          ],
          ["Playing time", "The rallies each player was on court. It needs a starting line-up."],
          ["Score progression", "Both scores, rally by rally."],
          ["Metrics", "Each skill: how many, its headline number, and its results as a bar."],
          ["Zones", "One skill on the court. The shade counts touches and the bar shows their results."],
          ["Player metrics", "Every player's plus/minus, and their net for each skill."],
          ["Player detail", "One skill, player by player."],
          ["Rally log", "Every touch. Filter it in the column headers."],
        ],
      },
      {
        title: "How the numbers are worked out",
        rows: [
          ["Serve efficiency", "(aces − errors) ÷ serves"],
          ["Positive % (receive, defense, freeball)", "Dig 2-3 ÷ all of them"],
          ["On %", "On ÷ sets"],
          ["Hitting %", "(kills − errors − blocked) ÷ attacks"],
          ["Setter tip, Success %", "Over (pt) ÷ balls the setter sent over"],
          ["Kill blocks", "Blocks that scored"],
          ["Net", "Good results minus errors, for one skill"],
          ["+/−", "Rallies won minus rallies lost while the player was on court"],
        ],
      },
    ],
    tips: [
      "The stats show what was last saved with **Save stats**. If a set looks out of date, its recorder has not saved the stats yet.",
      "Hover a metric's name to see its formula on the page.",
      "A ball the setter sends over counts as a **Setter tip**, not a set.",
    ],
    related: ["highlights", "report", "record"],
  },
  {
    id: "highlights",
    group: "Stats",
    title: "Watch highlights",
    icon: Clapperboard,
    intro: "Choose what you want to see and the app plays those moments back to back.",
    tasks: [
      {
        title: "Play a set of clips",
        steps: [
          "Open a game and press its **Highlights** tab.",
          "Press what you want under **Match**, **Set**, **Player**, **Action**, **Outcome**, and **Zone**. The number on each choice is how many moments it adds.",
          "Press **Play all**.",
          "Press **Prev** or **Next** to move between clips, or press any clip in the list.",
        ],
        after:
          "Two choices in one row widen the list (attacks or serves). Choices in different rows narrow it (attacks by one player).",
      },
      {
        title: "Make clips longer or shorter",
        steps: [
          "Under **Padding (seconds)**, set **Before** and **After**.",
          "Moments that run into each other join into one clip, so a whole rally plays in one go.",
        ],
      },
      {
        title: "Share one moment",
        steps: [
          "Find the clip in the list.",
          "Press its set and score at the left. The moment opens on YouTube in a new tab.",
          "Copy the address from there.",
        ],
      },
    ],
    tips: [
      "With nothing chosen, **Play all** plays every touch of every set.",
      "A set recorded from a local video file has no clips. It needs a YouTube link.",
      "**Rotate** turns a video that was filmed sideways.",
    ],
    related: ["read-stats", "report"],
  },
  {
    id: "report",
    group: "Stats",
    title: "Make a match report",
    icon: FileText,
    intro: "The report is a fixed summary of a set or a match that you can hand out.",
    tasks: [
      {
        title: "Download a report",
        steps: [
          "Open a game and press its **Match report** tab.",
          "Scroll to the bottom.",
          "Press **Download PDF**, or **Download HTML** for a file that opens in a browser.",
        ],
        after: "The video links stay clickable in both.",
      },
    ],
    references: [
      {
        title: "What is in it",
        rows: [
          ["Header", "The teams, the date, the result, and a link to each set's video."],
          ["Each skill", "Serves, attacks, sets, receive, defense, and blocks: their results, and where on the court."],
          ["Per player", "Attack, serve, receive, and defense results for each player, and who each setter set."],
          ["Score progression", "One chart per set."],
          ["Opponent errors", "The points their errors gave you, by kind."],
          ["YouTube links", "Every recorded moment as a link, by player and skill."],
        ],
      },
    ],
    tips: [
      "Opened from one game, the report covers the whole match. Opened from the tracker, it covers the set you are recording.",
      "The report has no filters. For one player or one set, use the **Stats** tab and its **PDF** button.",
    ],
    related: ["read-stats", "highlights"],
  },
  {
    id: "import-sets",
    group: "Stats",
    title: "Import set files",
    icon: FolderInput,
    who: "Coaches",
    intro: "Bring in sets that were recorded elsewhere and saved with **Export JSON**.",
    tasks: [
      {
        title: "Import sets into your games",
        steps: [
          "Open **Games**, or a game's **Overview** tab, and press **Import set files**.",
          "Press **Choose files…** and pick the files. Choose again to add files from another folder.",
          "Check each group. **Into** says which game the sets join: **A new game**, or one you already have.",
          "If both teams are named, say which one is yours.",
          "Under **Not on the … roster**, deal with each name: **Add to the roster** with a number and position, or **Same as #…** if the player is already there under another spelling.",
          "Press **Import 3 sets**.",
        ],
        after:
          "Sets with the same date and teams land in one game. A new game takes its name, date, and opponent from the files.",
      },
      {
        title: "Look at files without saving them",
        steps: [
          "Open any set in the tracker. Under **Set**, press **Stats and highlights from set files…**.",
          "Pick the files. The stats open, and nothing is stored.",
        ],
      },
      {
        title: "Match names after the fact",
        intro:
          "A game page shows **In the sets, not on the roster** when its sets name players the roster does not have.",
        steps: [
          "For each name, choose **Add to the roster** or the player it belongs to.",
          "Press **Add to the squad**.",
        ],
      },
    ],
    tips: [
      "If an import stops part-way, run it again. What was saved is kept and nothing is saved twice.",
      "Importing a set number the game already has adds a second copy. Delete the one you do not want afterwards.",
      "Renaming a roster player renames them in every recorded set.",
    ],
    related: ["fix-stats", "team"],
  },
  {
    id: "help",
    group: "Help",
    title: "When something goes wrong",
    icon: LifeBuoy,
    intro: "Most mistakes can be undone.",
    concepts: [
      {
        term: "A change you regret",
        text: "Open the board or note, press **More actions**, and choose **History…**. Pick an earlier version and press **Restore this version**.",
      },
      {
        term: "Something deleted by mistake",
        text: "Deleted boards and notes are kept for about three months. Ask your administrator to restore them. Deleted games and sets are gone for good, but a deleted set downloads as a file first.",
      },
      {
        term: "A page that says it isn't here",
        text: "The link is broken, or the board is no longer shared with you. Ask its owner to share it again.",
      },
      {
        term: "Stats that will not save",
        text: "Keep the tab open and keep recording. Your work stays in this browser until it can be saved.",
      },
      {
        term: "Your name or password",
        text: "Change your name under **Account settings** in the account menu. For a new password, sign out and press **Forgot password?** on the sign-in screen.",
      },
      {
        term: "A bug or an idea",
        text: "Open the account menu at the top right and choose **Report a problem…**.",
      },
    ],
    related: ["keep", "fix-stats"],
  },
];

export function guideTopic(id: string | null): GuideTopic | undefined {
  return GUIDE_TOPICS.find((topic) => topic.id === id);
}
