import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faFlagCheckered,
  faGamepad,
  faMinus,
  faPlay,
  faPlus,
  faRotate,
  faTrash,
  faTrophy,
  faUpload,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

type Screen = "landing" | "players" | "games" | "entry" | "finish";
type GameMode = "round_robin" | "high_score";

type Player = {
  id: string;
  name: string;
  image: string | null;
};

type MatchInput = {
  scoreA: string;
  scoreB: string;
};

type RoundRobinResult = {
  mode: "round_robin";
  matches: Record<string, MatchInput>;
};

type HighScoreResult = {
  mode: "high_score";
  scores: Record<string, string>;
};

type GameResult = RoundRobinResult | HighScoreResult;

type TournamentState = {
  screen: Screen;
  players: Player[];
  selectedGameId: string | null;
  gameResults: Record<string, GameResult>;
  activeMatchByGame: Record<string, string>;
  activeHighScoreByGame: Record<string, string>;
};

type GameDefinition = {
  id: string;
  name: string;
  mode: GameMode;
  description: string;
  cover: string;
};

type RankingRow = {
  playerId: string;
  playerName: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  highScoreTotal: number;
};

const STORAGE_KEY = "kzmg-tournament-v1";
const IMAGE_DB_NAME = "kzmg-media-v1";
const IMAGE_STORE_NAME = "player-images";

type PlayerImageRecord = {
  playerId: string;
  image: string;
};

const openImageDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME, { keyPath: "playerId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Nie udalo sie otworzyc IndexedDB"));
  });

const getAllPlayerImagesFromDb = async () => {
  const db = await openImageDb();

  return new Promise<Record<string, string>>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readonly");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const images: Record<string, string> = {};
      (request.result as PlayerImageRecord[]).forEach((entry) => {
        images[entry.playerId] = entry.image;
      });
      resolve(images);
    };

    request.onerror = () =>
      reject(
        request.error ?? new Error("Nie udalo sie odczytac zdjec z IndexedDB"),
      );

    transaction.oncomplete = () => db.close();
  });
};

const savePlayerImageToDb = async (playerId: string, image: string) => {
  const db = await openImageDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    store.put({ playerId, image } as PlayerImageRecord);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Nie udalo sie zapisac zdjecia w IndexedDB"),
      );
    };
  });
};

const removePlayerImageFromDb = async (playerId: string) => {
  const db = await openImageDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    store.delete(playerId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Nie udalo sie usunac zdjecia z IndexedDB"),
      );
    };
  });
};

const clearAllPlayerImagesFromDb = async () => {
  const db = await openImageDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    store.clear();

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ??
          new Error("Nie udalo sie wyczyscic obrazow z IndexedDB"),
      );
    };
  });
};

const stripImagesFromState = (state: TournamentState): TournamentState => ({
  ...state,
  players: state.players.map((player) => ({ ...player, image: null })),
});

const GAME_DEFINITIONS: GameDefinition[] = [
  {
    id: "pong",
    name: "PONG",
    mode: "round_robin",
    description: "Każdy z każdym",
    cover: `${import.meta.env.BASE_URL}covers/pong2.png`,
  },
  {
    id: "basketball",
    name: "Basketball",
    mode: "round_robin",
    description: "Każdy z każdym",
    cover: `${import.meta.env.BASE_URL}covers/basketball2.png`,
  },
  {
    id: "dodge-em",
    name: "Dodge 'Em",
    mode: "high_score",
    description: "Najwyższy wynik",
    cover: `${import.meta.env.BASE_URL}covers/dodge_em2.gif`,
  },
  {
    id: "centipide",
    name: "Centipide",
    mode: "high_score",
    description: "Najwyższy wynik",
    cover: `${import.meta.env.BASE_URL}covers/centipede.gif`,
  },
  {
    id: "asteroids",
    name: "Asteroids",
    mode: "high_score",
    description: "Najwyższy wynik",
    cover: `${import.meta.env.BASE_URL}covers/asteroids2.gif`,
  },
  {
    id: "flag-capture",
    name: "Flag Capture",
    mode: "round_robin",
    description: "Każdy z każdym",
    cover: `${import.meta.env.BASE_URL}covers/flag_capture2.gif`,
  },
  {
    id: "tennis",
    name: "Tennis",
    mode: "round_robin",
    description: "Każdy z każdym",
    cover: `${import.meta.env.BASE_URL}covers/tennis2.gif`,
  },
  {
    id: "maze-craze",
    name: "Maze Craze",
    mode: "round_robin",
    description: "Każdy z każdym",
    cover: `${import.meta.env.BASE_URL}covers/maze-craze2.jpg`,
  },
];

const createDefaultPlayers = (count: number): Player[] =>
  Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `Gracz ${index + 1}`,
    image: null,
  }));

const getMatchKey = (playerAId: string, playerBId: string) =>
  [playerAId, playerBId].sort().join("__");

const createDefaultState = (): TournamentState => ({
  screen: "landing",
  players: createDefaultPlayers(2),
  selectedGameId: null,
  gameResults: {},
  activeMatchByGame: {},
  activeHighScoreByGame: {},
});

const loadInitialState = (): TournamentState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as Partial<TournamentState>;
    if (!parsed || typeof parsed !== "object") {
      return createDefaultState();
    }

    const players = Array.isArray(parsed.players)
      ? parsed.players
          .filter((item): item is Player => {
            if (!item || typeof item !== "object") {
              return false;
            }
            const candidate = item as Player;
            return (
              typeof candidate.id === "string" &&
              typeof candidate.name === "string" &&
              (typeof candidate.image === "string" || candidate.image === null)
            );
          })
          .slice(0, 12)
      : [];

    const safePlayers = players.length >= 2 ? players : createDefaultPlayers(2);

    return {
      screen:
        parsed.screen === "landing" ||
        parsed.screen === "players" ||
        parsed.screen === "games" ||
        parsed.screen === "entry" ||
        parsed.screen === "finish"
          ? parsed.screen
          : "landing",
      players: safePlayers,
      selectedGameId:
        typeof parsed.selectedGameId === "string"
          ? parsed.selectedGameId
          : null,
      gameResults:
        parsed.gameResults && typeof parsed.gameResults === "object"
          ? parsed.gameResults
          : {},
      activeMatchByGame:
        parsed.activeMatchByGame && typeof parsed.activeMatchByGame === "object"
          ? Object.fromEntries(
              Object.entries(parsed.activeMatchByGame).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" && typeof entry[1] === "string",
              ),
            )
          : {},
      activeHighScoreByGame:
        parsed.activeHighScoreByGame &&
        typeof parsed.activeHighScoreByGame === "object"
          ? Object.fromEntries(
              Object.entries(parsed.activeHighScoreByGame).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" && typeof entry[1] === "string",
              ),
            )
          : {},
    };
  } catch {
    return createDefaultState();
  }
};

const toNumber = (value: string): number | null => {
  if (value.trim() === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
};

function App() {
  const [state, setState] = useState<TournamentState>(loadInitialState);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const playerIdsSignature = useMemo(
    () => state.players.map((player) => player.id).join("|"),
    [state.players],
  );

  const selectedGame = GAME_DEFINITIONS.find(
    (game) => game.id === state.selectedGameId,
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stripImagesFromState(state)),
      );
    } catch (error) {
      console.error("Nie udalo sie zapisac stanu do localStorage", error);
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const hydratePlayerImages = async () => {
      try {
        const imagesInDb = await getAllPlayerImagesFromDb();
        const hasImagesInDb = Object.keys(imagesInDb).length > 0;

        const legacyImages = state.players
          .filter(
            (player) =>
              typeof player.image === "string" && player.image.length > 0,
          )
          .map((player) => ({
            playerId: player.id,
            image: player.image as string,
          }));

        if (!hasImagesInDb && legacyImages.length > 0) {
          await Promise.all(
            legacyImages.map((entry) =>
              savePlayerImageToDb(entry.playerId, entry.image).catch(
                () => undefined,
              ),
            ),
          );
        }

        const hydratedImages = hasImagesInDb
          ? imagesInDb
          : Object.fromEntries(
              legacyImages.map(
                (entry) => [entry.playerId, entry.image] as const,
              ),
            );

        if (cancelled || Object.keys(hydratedImages).length === 0) {
          return;
        }

        setState((current) => ({
          ...current,
          players: current.players.map((player) => ({
            ...player,
            image: hydratedImages[player.id] ?? player.image ?? null,
          })),
        }));
      } catch (error) {
        console.error("Nie udalo sie odczytac zdjec z IndexedDB", error);
      }
    };

    void hydratePlayerImages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const removeOrphanImages = async () => {
      try {
        const images = await getAllPlayerImagesFromDb();
        const activeIds = new Set(state.players.map((player) => player.id));
        const staleIds = Object.keys(images).filter((id) => !activeIds.has(id));

        if (staleIds.length === 0) {
          return;
        }

        await Promise.all(
          staleIds.map((playerId) =>
            removePlayerImageFromDb(playerId).catch(() => undefined),
          ),
        );
      } catch (error) {
        console.error("Nie udalo sie wyczyscic osieroconych obrazow", error);
      }
    };

    void removeOrphanImages();
  }, [playerIdsSignature, state.players]);

  const roundRobinPairs = useMemo(() => {
    const pairs: Array<{ playerA: Player; playerB: Player; key: string }> = [];
    for (let indexA = 0; indexA < state.players.length; indexA += 1) {
      for (
        let indexB = indexA + 1;
        indexB < state.players.length;
        indexB += 1
      ) {
        const playerA = state.players[indexA];
        const playerB = state.players[indexB];
        pairs.push({
          playerA,
          playerB,
          key: getMatchKey(playerA.id, playerB.id),
        });
      }
    }
    return pairs;
  }, [state.players]);

  const ranking = useMemo<RankingRow[]>(() => {
    const rows = new Map<string, RankingRow>();

    state.players.forEach((player) => {
      rows.set(player.id, {
        playerId: player.id,
        playerName: player.name.trim() || "Bez nazwy",
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scored: 0,
        conceded: 0,
        highScoreTotal: 0,
      });
    });

    GAME_DEFINITIONS.forEach((game) => {
      const gameResult = state.gameResults[game.id];
      if (!gameResult) {
        return;
      }

      if (game.mode === "round_robin" && gameResult.mode === "round_robin") {
        roundRobinPairs.forEach((pair) => {
          const match = gameResult.matches[pair.key];
          if (!match) {
            return;
          }

          const scoreA = toNumber(match.scoreA);
          const scoreB = toNumber(match.scoreB);
          if (scoreA === null || scoreB === null) {
            return;
          }

          const rowA = rows.get(pair.playerA.id);
          const rowB = rows.get(pair.playerB.id);
          if (!rowA || !rowB) {
            return;
          }

          rowA.played += 1;
          rowB.played += 1;
          rowA.scored += scoreA;
          rowA.conceded += scoreB;
          rowB.scored += scoreB;
          rowB.conceded += scoreA;

          if (scoreA > scoreB) {
            rowA.points += 3;
            rowA.wins += 1;
            rowB.losses += 1;
          } else if (scoreA < scoreB) {
            rowB.points += 3;
            rowB.wins += 1;
            rowA.losses += 1;
          } else {
            rowA.points += 1;
            rowB.points += 1;
            rowA.draws += 1;
            rowB.draws += 1;
          }
        });
      }

      if (game.mode === "high_score" && gameResult.mode === "high_score") {
        const validScores = state.players
          .map((player) => ({
            playerId: player.id,
            value: toNumber(gameResult.scores[player.id] ?? ""),
          }))
          .filter(
            (entry): entry is { playerId: string; value: number } =>
              entry.value !== null,
          )
          .sort((entryA, entryB) => entryB.value - entryA.value);

        let rankPosition = 0;
        let previousScore: number | null = null;

        validScores.forEach((entry, index) => {
          if (previousScore === null || entry.value < previousScore) {
            rankPosition = index + 1;
          }
          previousScore = entry.value;

          const row = rows.get(entry.playerId);
          if (!row) {
            return;
          }

          const placementPoints = Math.max(
            state.players.length - rankPosition + 1,
            1,
          );
          row.points += placementPoints;
          row.highScoreTotal += entry.value;
          row.played += 1;
        });
      }
    });

    return [...rows.values()].sort((rowA, rowB) => {
      if (rowB.points !== rowA.points) {
        return rowB.points - rowA.points;
      }
      const diffA = rowA.scored - rowA.conceded;
      const diffB = rowB.scored - rowB.conceded;
      if (diffB !== diffA) {
        return diffB - diffA;
      }
      if (rowB.scored !== rowA.scored) {
        return rowB.scored - rowA.scored;
      }
      if (rowB.highScoreTotal !== rowA.highScoreTotal) {
        return rowB.highScoreTotal - rowA.highScoreTotal;
      }
      return rowA.playerName.localeCompare(rowB.playerName, "pl");
    });
  }, [roundRobinPairs, state.gameResults, state.players]);

  const playersReady = state.players.every(
    (player) => player.name.trim().length > 0,
  );

  const currentStep =
    state.screen === "landing"
      ? 0
      : state.screen === "players"
        ? 1
        : state.screen === "games"
          ? 2
          : state.screen === "entry"
            ? 3
            : 4;

  const getGameProgress = (game: GameDefinition) => {
    const result = state.gameResults[game.id];

    if (game.mode === "round_robin") {
      const total = roundRobinPairs.length;
      if (!result || result.mode !== "round_robin") {
        return { filled: 0, total };
      }
      const filled = roundRobinPairs.reduce((count, pair) => {
        const match = result.matches[pair.key];
        if (!match) {
          return count;
        }
        return toNumber(match.scoreA) !== null &&
          toNumber(match.scoreB) !== null
          ? count + 1
          : count;
      }, 0);
      return { filled, total };
    }

    const total = state.players.length;
    if (!result || result.mode !== "high_score") {
      return { filled: 0, total };
    }
    const filled = state.players.reduce((count, player) => {
      return toNumber(result.scores[player.id] ?? "") !== null
        ? count + 1
        : count;
    }, 0);
    return { filled, total };
  };

  const setScreen = (screen: Screen) => {
    setState((current) => ({ ...current, screen }));
  };

  const handlePlayerCountChange = (nextCount: number) => {
    const safeCount = Math.max(2, Math.min(12, nextCount));
    setState((current) => {
      if (safeCount === current.players.length) {
        return current;
      }

      if (safeCount > current.players.length) {
        const additional = Array.from(
          { length: safeCount - current.players.length },
          (_, offset) => ({
            id: crypto.randomUUID(),
            name: `Gracz ${current.players.length + offset + 1}`,
            image: null,
          }),
        );
        return { ...current, players: [...current.players, ...additional] };
      }

      const trimmedPlayers = current.players.slice(0, safeCount);
      return {
        ...current,
        players: trimmedPlayers,
      };
    });
  };

  const updatePlayer = (playerId: string, nextValues: Partial<Player>) => {
    setState((current) => ({
      ...current,
      players: current.players.map((player) =>
        player.id === playerId ? { ...player, ...nextValues } : player,
      ),
    }));
  };

  const setPlayerImage = (playerId: string, image: string | null) => {
    updatePlayer(playerId, { image });

    if (image) {
      void savePlayerImageToDb(playerId, image).catch((error) => {
        console.error("Nie udalo sie zapisac zdjecia gracza", error);
      });
      return;
    }

    void removePlayerImageFromDb(playerId).catch((error) => {
      console.error("Nie udalo sie usunac zdjecia gracza", error);
    });
  };

  const selectGame = (gameId: string) => {
    setState((current) => ({
      ...current,
      selectedGameId: gameId,
      screen: "entry",
    }));
  };

  const setActiveRoundRobinMatch = (gameId: string, matchKey: string) => {
    setState((current) => ({
      ...current,
      activeMatchByGame: {
        ...current.activeMatchByGame,
        [gameId]: matchKey,
      },
    }));
  };

  const setActiveHighScorePlayer = (gameId: string, playerId: string) => {
    setState((current) => ({
      ...current,
      activeHighScoreByGame: {
        ...current.activeHighScoreByGame,
        [gameId]: playerId,
      },
    }));
  };

  const setRoundRobinMatch = (
    gameId: string,
    matchKey: string,
    nextValue: MatchInput,
  ) => {
    setState((current) => {
      const previousResult = current.gameResults[gameId];
      const existingMatches =
        previousResult && previousResult.mode === "round_robin"
          ? previousResult.matches
          : {};

      return {
        ...current,
        gameResults: {
          ...current.gameResults,
          [gameId]: {
            mode: "round_robin",
            matches: {
              ...existingMatches,
              [matchKey]: nextValue,
            },
          },
        },
      };
    });
  };

  const setHighScore = (gameId: string, playerId: string, score: string) => {
    setState((current) => {
      const previousResult = current.gameResults[gameId];
      const existingScores =
        previousResult && previousResult.mode === "high_score"
          ? previousResult.scores
          : {};

      return {
        ...current,
        gameResults: {
          ...current.gameResults,
          [gameId]: {
            mode: "high_score",
            scores: {
              ...existingScores,
              [playerId]: score,
            },
          },
        },
      };
    });
  };

  const resetTournament = () => {
    const shouldReset = window.confirm(
      "Na pewno chcesz zresetować cały turniej?",
    );
    if (!shouldReset) {
      return;
    }

    void clearAllPlayerImagesFromDb().catch((error) => {
      console.error("Nie udalo sie wyczyscic obrazow graczy", error);
    });

    setState(createDefaultState());
  };

  const clearCurrentGameResults = (gameId: string) => {
    setState((current) => {
      const nextResults = { ...current.gameResults };
      delete nextResults[gameId];
      return {
        ...current,
        gameResults: nextResults,
      };
    });
  };

  const renderLanding = () => (
    <section className="view hero-view view-landing">
      <p className="kicker">Turniej Atari</p>
      <h1>Kto zostanie mistrzem gier</h1>
      <button
        className="primary hero-start-btn"
        type="button"
        onClick={() => setScreen("players")}
      >
        <FontAwesomeIcon icon={faPlay} size={"2x"} />
      </button>
    </section>
  );

  const renderPlayers = () => (
    <section className="view view-players">
      <div className="section-head">
        <div>
          <h2>
            <FontAwesomeIcon icon={faUsers} />
            <span>Gracze</span>
          </h2>
        </div>
        <div className="count-box">
          <div className="player-count-controls" aria-label="Liczba graczy">
            <button
              className="ghost icon-btn"
              type="button"
              aria-label="Zmniejsz liczbę graczy"
              title="Mniej graczy"
              onClick={() => handlePlayerCountChange(state.players.length - 1)}
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <strong className="player-count-value" aria-live="polite">
              {state.players.length}
            </strong>
            <button
              className="primary icon-btn"
              type="button"
              aria-label="Zwiększ liczbę graczy"
              title="Więcej graczy"
              onClick={() => handlePlayerCountChange(state.players.length + 1)}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        </div>
      </div>

      <div className="players-grid">
        {state.players.map((player, index) => (
          <article
            key={player.id}
            className="player-card player-card-animated"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="avatar-wrap">
              {player.image ? (
                <img
                  src={player.image}
                  alt={player.name || `Gracz ${index + 1}`}
                />
              ) : (
                <span>
                  {(player.name || `G${index + 1}`).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <input
              type="text"
              value={player.name}
              maxLength={30}
              aria-label={`Nazwa gracza ${index + 1}`}
              onChange={(event) =>
                updatePlayer(player.id, { name: event.target.value })
              }
              placeholder={`Gracz ${index + 1}`}
            />
            <div className="player-card-actions">
              <label
                className="upload-btn icon-btn"
                aria-label={`Dodaj zdjęcie gracza ${index + 1}`}
                title="Dodaj zdjęcie"
              >
                <FontAwesomeIcon icon={faUpload} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = () => {
                      const image =
                        typeof reader.result === "string"
                          ? reader.result
                          : null;
                      setPlayerImage(player.id, image);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {player.image ? (
                <button
                  type="button"
                  className="inline-danger icon-btn"
                  aria-label={`Usuń zdjęcie gracza ${index + 1}`}
                  title="Usuń zdjęcie"
                  onClick={() => setPlayerImage(player.id, null)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="actions">
        <button
          className="ghost icon-btn"
          type="button"
          aria-label="Wstecz"
          title="Wstecz"
          onClick={() => setScreen("landing")}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <button
          className="primary icon-btn"
          type="button"
          disabled={!playersReady}
          aria-label="Dalej"
          title="Dalej"
          onClick={() => setScreen("games")}
        >
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
      {!playersReady ? (
        <p className="warning">Uzupełnij nazwy graczy.</p>
      ) : null}
    </section>
  );

  const renderGames = () => (
    <section className="view view-games">
      <div className="section-head">
        <div>
          <h2>
            <FontAwesomeIcon icon={faGamepad} />
            <span>Gry</span>
          </h2>
        </div>
      </div>

      <div className="game-grid">
        {GAME_DEFINITIONS.map((game, index) => {
          const progress = getGameProgress(game);
          const done = progress.total > 0 && progress.filled === progress.total;
          return (
            <button
              key={game.id}
              type="button"
              className={`game-card ${done ? "done" : ""}`}
              style={{
                backgroundImage: `linear-gradient(140deg, rgba(6, 26, 40, 0.72), rgba(8, 64, 84, 0.42)), url(${game.cover})`,
                animationDelay: `${index * 90}ms`,
              }}
              onClick={() => selectGame(game.id)}
            >
              <h3>{game.name}</h3>
              <small>
                <FontAwesomeIcon
                  icon={game.mode === "round_robin" ? faUsers : faTrophy}
                />
                {progress.filled}/{progress.total}
              </small>
            </button>
          );
        })}
      </div>

      <div className="actions">
        <button
          className="ghost icon-btn"
          type="button"
          aria-label="Wstecz"
          title="Wstecz"
          onClick={() => setScreen("players")}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <button
          className="primary icon-btn"
          type="button"
          aria-label="Podium"
          title="Podium"
          onClick={() => setScreen("finish")}
        >
          <FontAwesomeIcon icon={faFlagCheckered} />
        </button>
      </div>
    </section>
  );

  const renderFinish = () => {
    const first = ranking[0];
    const second = ranking[1];
    const third = ranking[2];
    const playerById = new Map(
      state.players.map((player) => [player.id, player]),
    );

    const renderFinishAvatar = (row?: RankingRow, sizeClass = "") => {
      if (!row) {
        return (
          <div
            className={`finish-avatar ${sizeClass}`.trim()}
            aria-hidden="true"
          >
            <span>--</span>
          </div>
        );
      }

      const player = playerById.get(row.playerId);
      const label = player?.name || row.playerName || "Gracz";

      return (
        <div className={`finish-avatar ${sizeClass}`.trim()}>
          {player?.image ? (
            <img src={player.image} alt={label} />
          ) : (
            <span>{label.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      );
    };

    return (
      <section className="view view-finish finish-view">
        <div className="pixel-fireworks" aria-hidden="true">
          <span className="burst burst-a" />
          <span className="burst burst-b" />
          <span className="burst burst-c" />
          <span className="burst burst-d" />
          <span className="burst burst-e" />
        </div>

        <div className="section-head finish-head">
          <div>
            <p className="kicker">Final</p>
            <h2>
              <FontAwesomeIcon icon={faTrophy} />
              <span>Podium</span>
            </h2>
          </div>
        </div>

        {ranking.length === 0 ? (
          <p className="warning">Brak wynikow do pokazania podium.</p>
        ) : (
          <>
            <div className="podium-wrap">
              <article className="podium-slot podium-second">
                <span className="podium-place">2</span>
                {renderFinishAvatar(second, "podium-avatar")}
                <strong>{second?.playerName ?? "-"}</strong>
                <small>{second?.points ?? 0} pts</small>
              </article>

              <article className="podium-slot podium-first">
                <span className="podium-place">1</span>
                {renderFinishAvatar(first, "podium-avatar")}
                <strong>{first?.playerName ?? "-"}</strong>
                <small>{first?.points ?? 0} pts</small>
              </article>

              <article className="podium-slot podium-third">
                <span className="podium-place">3</span>
                {renderFinishAvatar(third, "podium-avatar")}
                <strong>{third?.playerName ?? "-"}</strong>
                <small>{third?.points ?? 0} pts</small>
              </article>
            </div>

            <div className="finish-ranking">
              {ranking.map((row, index) => (
                <div
                  key={row.playerId}
                  className="finish-row"
                  style={{ animationDelay: `${index * 85}ms` }}
                >
                  <div className="finish-row-player">
                    {renderFinishAvatar(row, "finish-avatar-small")}
                    <strong>
                      {index + 1}. {row.playerName}
                    </strong>
                  </div>
                  <span>{row.points} pts</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="actions">
          <button
            className="ghost icon-btn"
            type="button"
            aria-label="Wroc do gier"
            title="Wroc do gier"
            onClick={() => setScreen("games")}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <button
            className="primary icon-btn"
            type="button"
            aria-label="Nowy turniej"
            title="Nowy turniej"
            onClick={resetTournament}
          >
            <FontAwesomeIcon icon={faRotate} />
          </button>
        </div>
      </section>
    );
  };

  const renderEntry = () => {
    if (!selectedGame) {
      return (
        <section className="view view-entry">
          <h2>Wybierz grę, aby wpisać wyniki</h2>
          <button
            className="primary"
            type="button"
            onClick={() => setScreen("games")}
          >
            Powrót do wyboru gier
          </button>
        </section>
      );
    }

    const result = state.gameResults[selectedGame.id];
    return (
      <section className="view view-entry">
        <div className="section-head">
          <div>
            <h2>{selectedGame.name}</h2>
          </div>
          <button
            type="button"
            className="ghost icon-btn"
            aria-label="Wyczyść wyniki tej gry"
            title="Wyczyść wyniki tej gry"
            onClick={() => clearCurrentGameResults(selectedGame.id)}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>

        {selectedGame.mode === "round_robin" ? (
          <div className="rr-stage">
            {(() => {
              const validMatchKey = state.activeMatchByGame[selectedGame.id];
              const hasValidActiveKey = roundRobinPairs.some(
                (pair) => pair.key === validMatchKey,
              );
              const activeMatchKey =
                hasValidActiveKey && validMatchKey
                  ? validMatchKey
                  : (roundRobinPairs[0]?.key ?? null);

              if (!activeMatchKey) {
                return <p>Brak rozgrywek dla aktualnej konfiguracji graczy.</p>;
              }

              const activePair = roundRobinPairs.find(
                (pair) => pair.key === activeMatchKey,
              );
              if (!activePair) {
                return null;
              }

              const activeInput =
                result && result.mode === "round_robin"
                  ? result.matches[activePair.key]
                  : undefined;
              const waitingPairs = roundRobinPairs.filter(
                (pair) => pair.key !== activePair.key,
              );

              return (
                <>
                  <div
                    key={activePair.key}
                    className="rr-active-match duel-intro"
                  >
                    <div className="rr-player-block duel-left">
                      <div className="rr-active-avatar">
                        {activePair.playerA.image ? (
                          <img
                            src={activePair.playerA.image}
                            alt={activePair.playerA.name || "Gracz A"}
                          />
                        ) : (
                          <span>
                            {(activePair.playerA.name || "GA")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <strong>{activePair.playerA.name || "Gracz A"}</strong>
                    </div>

                    <div className="rr-score-box duel-center">
                      <input
                        className="score-number-input rr-score-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={activeInput?.scoreA ?? ""}
                        placeholder="0"
                        aria-label="Wynik gracza A"
                        onKeyDown={(event) => {
                          if (
                            event.key === "e" ||
                            event.key === "E" ||
                            event.key === "+" ||
                            event.key === "-"
                          ) {
                            event.preventDefault();
                          }
                        }}
                        onChange={(event) =>
                          setRoundRobinMatch(selectedGame.id, activePair.key, {
                            scoreA: event.target.value,
                            scoreB: activeInput?.scoreB ?? "",
                          })
                        }
                      />

                      <span className="score-separator">:</span>

                      <input
                        className="score-number-input rr-score-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={activeInput?.scoreB ?? ""}
                        placeholder="0"
                        aria-label="Wynik gracza B"
                        onKeyDown={(event) => {
                          if (
                            event.key === "e" ||
                            event.key === "E" ||
                            event.key === "+" ||
                            event.key === "-"
                          ) {
                            event.preventDefault();
                          }
                        }}
                        onChange={(event) =>
                          setRoundRobinMatch(selectedGame.id, activePair.key, {
                            scoreA: activeInput?.scoreA ?? "",
                            scoreB: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="rr-player-block duel-right">
                      <div className="rr-active-avatar">
                        {activePair.playerB.image ? (
                          <img
                            src={activePair.playerB.image}
                            alt={activePair.playerB.name || "Gracz B"}
                          />
                        ) : (
                          <span>
                            {(activePair.playerB.name || "GB")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <strong>{activePair.playerB.name || "Gracz B"}</strong>
                    </div>
                  </div>

                  <div className="rr-queue-wrap">
                    <div className="rr-queue-grid">
                      {waitingPairs.map((pair) => {
                        const queueInput =
                          result && result.mode === "round_robin"
                            ? result.matches[pair.key]
                            : undefined;
                        const queueScoreA = Math.max(
                          0,
                          Number(queueInput?.scoreA ?? 0) || 0,
                        );
                        const queueScoreB = Math.max(
                          0,
                          Number(queueInput?.scoreB ?? 0) || 0,
                        );

                        return (
                          <button
                            key={pair.key}
                            type="button"
                            className="rr-queue-card"
                            onClick={() =>
                              setActiveRoundRobinMatch(
                                selectedGame.id,
                                pair.key,
                              )
                            }
                          >
                            <div className="versus-row">
                              <div className="versus-avatar">
                                {pair.playerA.image ? (
                                  <img
                                    src={pair.playerA.image}
                                    alt={pair.playerA.name || "Gracz A"}
                                  />
                                ) : (
                                  <span>
                                    {(pair.playerA.name || "GA")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <strong className="rr-queue-score">
                                <span
                                  key={`${pair.key}-${queueScoreA}-${queueScoreB}`}
                                  className="score-pop-mini"
                                >
                                  {queueScoreA}:{queueScoreB}
                                </span>
                              </strong>
                              <div className="versus-avatar">
                                {pair.playerB.image ? (
                                  <img
                                    src={pair.playerB.image}
                                    alt={pair.playerB.name || "Gracz B"}
                                  />
                                ) : (
                                  <span>
                                    {(pair.playerB.name || "GB")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="hs-stage">
            {(() => {
              const validPlayerId =
                state.activeHighScoreByGame[selectedGame.id];
              const hasValidPlayer = state.players.some(
                (player) => player.id === validPlayerId,
              );
              const activePlayerId =
                hasValidPlayer && validPlayerId
                  ? validPlayerId
                  : (state.players[0]?.id ?? null);

              if (!activePlayerId) {
                return <p>Brak graczy do wprowadzenia wyniku.</p>;
              }

              const activePlayer = state.players.find(
                (player) => player.id === activePlayerId,
              );
              if (!activePlayer) {
                return null;
              }

              const activeScore =
                result && result.mode === "high_score"
                  ? (result.scores[activePlayer.id] ?? "")
                  : "";

              const waitingPlayers = state.players.filter(
                (player) => player.id !== activePlayer.id,
              );

              return (
                <>
                  <div
                    key={activePlayer.id}
                    className="hs-active-player hs-intro"
                  >
                    <div className="rr-player-block hs-focus-player">
                      <div className="rr-active-avatar hs-focus-avatar">
                        {activePlayer.image ? (
                          <img
                            src={activePlayer.image}
                            alt={activePlayer.name || "Gracz"}
                          />
                        ) : (
                          <span>
                            {(activePlayer.name || "G")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <strong>{activePlayer.name || "Bez nazwy"}</strong>
                    </div>

                    <input
                      className="score-number-input score-number-input-large"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={activeScore}
                      placeholder="Wynik"
                      onKeyDown={(event) => {
                        if (
                          event.key === "e" ||
                          event.key === "E" ||
                          event.key === "+"
                        ) {
                          event.preventDefault();
                        }
                      }}
                      onChange={(event) =>
                        setHighScore(
                          selectedGame.id,
                          activePlayer.id,
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="hs-queue-wrap">
                    <div className="hs-queue-grid">
                      {waitingPlayers.map((player) => {
                        const score =
                          result && result.mode === "high_score"
                            ? (result.scores[player.id] ?? "")
                            : "";

                        return (
                          <button
                            key={player.id}
                            type="button"
                            className="hs-queue-card"
                            onClick={() =>
                              setActiveHighScorePlayer(
                                selectedGame.id,
                                player.id,
                              )
                            }
                          >
                            <div className="versus-avatar">
                              {player.image ? (
                                <img
                                  src={player.image}
                                  alt={player.name || "Gracz"}
                                />
                              ) : (
                                <span>
                                  {(player.name || "G")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              )}
                            </div>
                            <strong>{player.name || "Bez nazwy"}</strong>
                            <span className="hs-queue-score">
                              <span
                                key={`${player.id}-${score || "-"}`}
                                className="score-pop-mini"
                              >
                                {score || "-"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className="actions">
          <button
            className="ghost icon-btn"
            type="button"
            aria-label="Wybór gry"
            title="Wybór gry"
            onClick={() => setScreen("games")}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <button
            className="primary icon-btn"
            type="button"
            aria-label="Zapisz i wróć"
            title="Zapisz i wróć"
            onClick={() => setScreen("games")}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      </section>
    );
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <strong>Kto zostanie mistrzem gier</strong>
        </div>
        <div className="top-actions">
          <button
            className="reset icon-btn"
            type="button"
            aria-label="Reset danych"
            title="Reset danych"
            onClick={resetTournament}
          >
            <FontAwesomeIcon icon={faRotate} />
          </button>
        </div>
      </header>

      <nav className="stepper" aria-label="Postęp kroków">
        <span className={currentStep >= 1 ? "active" : ""} title="Gracze">
          <FontAwesomeIcon icon={faUsers} />
        </span>
        <span className={currentStep >= 2 ? "active" : ""} title="Gra">
          <FontAwesomeIcon icon={faGamepad} />
        </span>
        <span className={currentStep >= 3 ? "active" : ""} title="Wyniki">
          <FontAwesomeIcon icon={faTrophy} />
        </span>
        <span className={currentStep >= 4 ? "active" : ""} title="Final">
          <FontAwesomeIcon icon={faFlagCheckered} />
        </span>
      </nav>

      {state.screen === "landing" && renderLanding()}
      {state.screen === "players" && renderPlayers()}
      {state.screen === "games" && renderGames()}
      {state.screen === "entry" && renderEntry()}
      {state.screen === "finish" && renderFinish()}

      <button
        className="drawer-toggle"
        type="button"
        aria-expanded={isDrawerOpen}
        onClick={() => setIsDrawerOpen((current) => !current)}
      >
        <FontAwesomeIcon
          icon={faTrophy}
          className={`drawer-toggle-icon ${isDrawerOpen ? "open" : ""}`}
        />
      </button>

      {isDrawerOpen ? (
        <button
          className="drawer-backdrop"
          type="button"
          aria-label="Zamknij tabelę wyników"
          onClick={() => setIsDrawerOpen(false)}
        />
      ) : null}

      <aside className={`leaderboard ${isDrawerOpen ? "open" : ""}`}>
        <h3>Aktualna tabela</h3>
        <div className="leaderboard-head">
          <span>Gracz</span>
          <span>Pts</span>
        </div>
        <div className="leaderboard-body">
          {ranking.map((row, index) => (
            <div
              key={row.playerId}
              className="leader-row"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div>
                <strong>
                  {index + 1}. {row.playerName}
                </strong>
                <small>
                  M: {row.played} | W: {row.wins} R: {row.draws} P: {row.losses}
                </small>
              </div>
              <span>{row.points}</span>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

export default App;
