import { useState, type FormEvent } from "react";

interface SearchFormProps {
  readonly onSearch: (query: string) => void | Promise<void>;
  readonly isSubmitting?: boolean;
}

const minimumQueryLength = 3;

export function SearchForm({
  onSearch,
  isSubmitting = false,
}: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (Array.from(trimmedQuery).length < minimumQueryLength) {
      setError("Enter at least 3 characters.");
      return;
    }

    setError(null);
    void onSearch(trimmedQuery);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit} noValidate>
      <div className="search-form__field">
        <label className="search-form__label" htmlFor="station-query">
          Station name
        </label>
        <input
          className="search-form__input"
          id="station-query"
          name="station"
          type="search"
          value={query}
          placeholder="Try Bru or Aac"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? "station-help station-error" : "station-help"}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (
              error &&
              Array.from(nextQuery.trim()).length >= minimumQueryLength
            ) {
              setError(null);
            }
          }}
        />
        <p className="search-form__help" id="station-help">
          Enter at least 3 characters
        </p>
        {error ? (
          <p className="search-form__error" id="station-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        className="search-form__submit"
        type="submit"
        disabled={isSubmitting}
      >
        Find departures
      </button>
    </form>
  );
}
