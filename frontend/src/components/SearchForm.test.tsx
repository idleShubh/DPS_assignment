// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchForm } from "./SearchForm";

afterEach(cleanup);

describe("SearchForm", () => {
  it("renders an accessible labelled search field", () => {
    render(<SearchForm onSearch={vi.fn()} />);

    const input = screen.getByRole("searchbox", { name: "Station name" });
    expect(input.getAttribute("placeholder")).toBe("Try Bru or Aac");
    expect(input.getAttribute("aria-describedby")).toBe("station-help");
    expect(screen.getByText("Enter at least 3 characters")).toBeTruthy();
  });

  it.each(["", "  ", "Br", "  Br  "])(
    "rejects an incomplete query of %j without searching",
    (query) => {
      const onSearch = vi.fn();
      render(<SearchForm onSearch={onSearch} />);
      const input = screen.getByRole("searchbox", { name: "Station name" });

      fireEvent.change(input, { target: { value: query } });
      fireEvent.click(screen.getByRole("button", { name: "Find departures" }));

      expect(onSearch).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toBe(
        "Enter at least 3 characters.",
      );
      expect(input.getAttribute("aria-invalid")).toBe("true");
    },
  );

  it("trims and submits a valid query", () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} />);
    const input = screen.getByRole("searchbox", { name: "Station name" });

    fireEvent.change(input, { target: { value: "  Bru  " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("Bru");
  });

  it("clears the validation error once the query becomes valid", () => {
    render(<SearchForm onSearch={vi.fn()} />);
    const input = screen.getByRole("searchbox", { name: "Station name" });

    fireEvent.change(input, { target: { value: "Br" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.queryByRole("alert")).toBeTruthy();

    fireEvent.change(input, { target: { value: "Bru" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("disables submission while a search is in progress", () => {
    render(<SearchForm onSearch={vi.fn()} isSubmitting />);

    const button = screen.getByRole("button", { name: "Find departures" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
