import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { GuideLink } from "../../src/guide/GuideLink";
import { GuidePage } from "../../src/guide/GuidePage";
import { GUIDE_GROUPS, GUIDE_TOPICS } from "../../src/guide/guideContent";

describe("the overview", () => {
  test("lists every topic by chapter and says it is AI-written", () => {
    render(<GuidePage topicId={null} onOpen={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "How to use VolleyVector" })).toBeInTheDocument();
    expect(screen.getByText(/written by AI/)).toBeInTheDocument();

    for (const group of GUIDE_GROUPS) {
      const section = screen.getByRole("region", { name: group });

      for (const topic of GUIDE_TOPICS.filter((t) => t.group === group))
        expect(within(section).getByRole("link", { name: new RegExp(topic.title) })).toHaveAttribute(
          "href",
          `/guide/${topic.id}`
        );
    }
  });

  test("a topic card opens its topic", async () => {
    const onOpen = vi.fn();

    render(<GuidePage topicId="not-a-topic" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("link", { name: /Record a set/ }));

    expect(onOpen).toHaveBeenCalledWith("record");
  });
});

describe("a topic", () => {
  test.each(GUIDE_TOPICS)("$id shows its tasks and lookups", (topic) => {
    render(<GuidePage topicId={topic.id} onOpen={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: topic.title })).toBeInTheDocument();
    expect(screen.getByText(/written by AI/)).toBeInTheDocument();

    for (const { title } of [...(topic.tasks ?? []), ...(topic.references ?? [])])
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
  });

  test("links to the neighbouring topics, the related ones, and back to the overview", async () => {
    const onOpen = vi.fn();

    render(<GuidePage topicId="record" onOpen={onOpen} />);

    const more = screen.getByRole("navigation", { name: "More topics" });

    expect(within(more).getByRole("link", { name: "How stats work" })).toBeInTheDocument();
    await userEvent.click(within(more).getByRole("link", { name: "Check and fix a set" }));
    await userEvent.click(screen.getByRole("link", { name: "All topics" }));

    expect(onOpen.mock.calls).toEqual([["fix-stats"], [null]]);
    expect(
      within(screen.getByRole("navigation", { name: "Guide topics" })).getByRole("link", { current: "page" })
    ).toHaveTextContent("Record a set");
  });
});

test("every related topic exists and ids are unique", () => {
  const ids = GUIDE_TOPICS.map((topic) => topic.id);

  expect(new Set(ids).size).toBe(ids.length);
  expect(GUIDE_TOPICS.flatMap((topic) => topic.related ?? []).filter((id) => !ids.includes(id))).toEqual([]);
});

test.each([
  { name: "as an icon", children: undefined, label: "Guide: Record a set" },
  { name: "as a text link", children: "How recording works", label: "How recording works" },
])("a help link $name opens its topic in a new tab", ({ children, label }) => {
  render(<GuideLink topic="record">{children}</GuideLink>);

  const link = screen.getByRole("link", { name: label });

  expect(link).toHaveAttribute("href", "/guide/record");
  expect(link).toHaveAttribute("target", "_blank");
});
