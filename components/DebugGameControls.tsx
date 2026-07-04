import React from 'react';
import type { TFunction } from 'i18next';

// Define the structure for scene data, mirroring what DomainGamePage uses
type SceneData = {
  choices?: { next: number }[];
};

/**
 * Props for the DebugGameControls component.
 */
type DebugGameControlsProps = {
  /** Data for all chapters and scenes, used to populate debug navigation. */
  allSceneData: Record<number, SceneData[]>;
  /** The currently active chapter number in the game. */
  currentChapter: number;
  /** The currently active scene number in the game. */
  currentScene: number;
  /** The chapter number selected in the debug UI for scene navigation, or null if none selected. */
  selectedDebugChapter: number | null;
  // historyLength prop removed
  /** Callback function triggered when a chapter button is clicked in the debug UI. */
  onChapterSelect: (chapterNum: number) => void;
  /** Callback function triggered when a scene button is clicked in the debug UI. */
  onSceneSelect: (chapterNum: number, sceneNum: number) => void;
  // onBack prop removed
  // onHome prop removed
  /** The translation function from `next-i18next`. */
  t: TFunction<'common', undefined>;
};

/**
 * A component that provides debug controls for game navigation.
 * This includes selecting chapters, scenes, and navigating back or to home.
 * It is only rendered when the game is in debug mode.
 */
const DebugGameControls: React.FC<DebugGameControlsProps> = ({
  allSceneData,
  currentChapter,
  currentScene,
  selectedDebugChapter,
  // historyLength, // Prop no longer passed
  onChapterSelect,
  onSceneSelect,
  // onBack, // Prop no longer passed
  // onHome, // Prop no longer passed
  t,
}) => {
  return (
    <>
      {selectedDebugChapter !== null && allSceneData && allSceneData[selectedDebugChapter] && (
        <div className="flex justify-center space-x-1 py-2 overflow-x-auto">
          {[...Array(allSceneData[selectedDebugChapter].length)].map((_, index) => {
            const sceneNumForButton = index;
            return (
              <button
                key={sceneNumForButton}
                onClick={() => onSceneSelect(selectedDebugChapter, sceneNumForButton)}
                className={`px-2 py-1 rounded-md transition-colors flex-shrink-0 text-xs ${selectedDebugChapter === currentChapter && sceneNumForButton === currentScene ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {selectedDebugChapter}-{sceneNumForButton + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-center space-x-2 py-2 overflow-x-auto">
        {allSceneData && Object.keys(allSceneData).map((key) => {
          const chapterNumForButton = parseInt(key, 10);
          return (
            <button
              key={chapterNumForButton}
              onClick={() => onChapterSelect(chapterNumForButton)}
              className={`px-3 py-1 rounded-md transition-colors flex-shrink-0 ${selectedDebugChapter === chapterNumForButton ? 'bg-blue-500 text-white' : currentChapter === chapterNumForButton ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
            >
              {chapterNumForButton}
            </button>
          );
        })}
      </div>

      {/* Removed Back and Home buttons container */}
    </>
  );
};

export default DebugGameControls;
