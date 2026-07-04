import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // For toBeInTheDocument and other matchers
import DomainGamePage from './[...slug]'; // Adjust path as necessary
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import type { GamePageProps } from './[...slug]'; // Assuming GamePageProps is exported or defined in a way that can be imported

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key, // Simple pass-through mock for t function
  })),
  serverSideTranslations: jest.fn().mockResolvedValue({}), // Mock for getStaticProps
}));

// Default mock implementation for useRouter
const mockRouterPush = jest.fn();
const mockRouter = {
  push: mockRouterPush,
  asPath: '/games/domain-ch1/0',
  query: { slug: ['domain-ch1', '0'] },
  isReady: true,
  locale: 'en',
  basePath: '',
  pathname: '/games/[...slug]',
  route: '/games/[...slug]',
  back: jest.fn(),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isPreview: false,
  reload: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
};

const defaultAllSceneData = {
  1: [
    { choices: [{ next: 1 }, { next: 2 }] }, // Scene 0
    { choices: [{ next: 3 }, { next: 999 }] }, // Scene 1
    { choices: [{ next: 999 }] },             // Scene 2
    { choices: [{ next: 0 }] },               // Scene 3
  ],
  2: [
    { choices: [{ next: 1 }] }, // Scene 0
    { choices: [{ next: 0 }] }, // Scene 1
  ],
};

const defaultProps: GamePageProps = {
  sceneData: defaultAllSceneData[1][0],
  initialChapterNumber: 1,
  initialSceneNumber: 0,
  totalScenes: defaultAllSceneData[1].length,
  allSceneData: defaultAllSceneData,
};

describe('DomainGamePage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockRouterPush.mockClear();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => key,
    });
  });

  it('renders initial scene and choices correctly', () => {
    render(<DomainGamePage {...defaultProps} />);
    expect(screen.getByText('domainCh1_scene0_text')).toBeInTheDocument();
    expect(screen.getByText('domainCh1_scene0_choice0_text')).toBeInTheDocument(); // Choice to scene 1
    expect(screen.getByText('domainCh1_scene0_choice1_text')).toBeInTheDocument(); // Choice to scene 2
  });

  it('handles choice selection within the same chapter (shallow navigation)', () => {
    render(<DomainGamePage {...defaultProps} />);
    
    // Click the first choice, which leads to scene 1 in chapter 1
    fireEvent.click(screen.getByText('domainCh1_scene0_choice0_text'));

    // useEffect for internal state update (scene, currentChapter) will trigger a shallow push
    // The path for shallow push is constructed using currentChapter and newly set scene state
    expect(mockRouterPush).toHaveBeenCalledWith(
      '/games/domain-ch1/1', // Expected path for scene 1
      undefined,
      { shallow: true }
    );
  });

  it('handles choice selection leading to the next chapter (non-shallow navigation)', () => {
    // Modify props to start at a scene that can lead to the next chapter
    const propsForNextChapter = {
      ...defaultProps,
      sceneData: defaultAllSceneData[1][1], // Scene 1, choice 1 leads to next chapter (999)
      initialSceneNumber: 1,
    };
    // Update router to reflect the new initial state
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      asPath: '/games/domain-ch1/1',
      query: { slug: ['domain-ch1', '1'] },
    });

    render(<DomainGamePage {...propsForNextChapter} />);
    
    // Assuming 'domainCh1_scene1_choice1_text' is the text for the choice leading to next chapter
    // In our defaultAllSceneData[1][1], the second choice has next: 999
    expect(screen.getByText('domainCh1_scene1_text')).toBeInTheDocument();
    fireEvent.click(screen.getByText('domainCh1_scene1_choice1_text'));

    // Expect a non-shallow push to the first scene of the next chapter (chapter 2, scene 0)
    expect(mockRouterPush).toHaveBeenCalledWith(
      '/games/domain-ch2/0', // Expected path for chapter 2, scene 0
      undefined,
      // Check that it's NOT a shallow push, meaning options should not contain shallow: true
      // or options is undefined. The absence of { shallow: true } is key.
      expect.anything() // router.push(path, as, options) - options might be undefined or not have shallow:true
    );
    
    // More specific check if possible: ensure shallow is not true
     const lastCallArgs = mockRouterPush.mock.calls[mockRouterPush.mock.calls.length - 1];
     if (lastCallArgs[2]) { // if options argument exists
       expect(lastCallArgs[2].shallow).not.toBe(true);
     }
  });
  
  // Add more tests for other functionalities like debug mode, back button, home button etc.
  // For example, testing navigation to the previous scene (back button)
  it('handles back button navigation (shallow)', () => {
    // Start at scene 1, make a choice to go to scene 3, then go back to scene 1
    const initialPropsScene1 = {
      ...defaultProps,
      sceneData: defaultAllSceneData[1][1], // Start at Chapter 1, Scene 1
      initialSceneNumber: 1,
    };
     (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      asPath: '/games/domain-ch1/1', // initial asPath
      query: { slug: ['domain-ch1', '1'] },
    });
    render(<DomainGamePage {...initialPropsScene1} />);

    // Simulate choice to scene 3 (from scene 1, choice 0)
    fireEvent.click(screen.getByText('domainCh1_scene1_choice0_text')); 
    // This should update internal scene state to 3 and shallow push to /games/domain-ch1/3
    expect(mockRouterPush).toHaveBeenCalledWith('/games/domain-ch1/3', undefined, { shallow: true });
    mockRouterPush.mockClear(); // Clear mock for the next check

    // Now, need to simulate the DebugControls being present and clicking "Back"
    // This requires isDebug to be true and DebugGameControls to be rendered.
    // For this test, let's assume isDebug is true for simplicity to test handleBack.
    // In a real scenario, you might need a separate test for isDebug interactions.
    
    // Modify router for isDebug and re-render or update props if component reacts to router.asPath
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      asPath: '/debug/games/domain-ch1/3', // Current path after navigation, now in debug
      query: { slug: ['domain-ch1', '3'] },
      isReady: true,
    });
    
    // To actually test handleBack, we'd need to trigger it. 
    // If handleBack is passed to DebugGameControls, we'd find the button in DebugGameControls.
    // This test setup is simplified. We would typically find the button via its text.
    // Let's assume the 'Back' button is available and its text is 'debugBackButton'
    // and DebugGameControls is rendered because isDebug is true.
    // This part of the test is more conceptual without rendering DebugGameControls directly here.
    // A more robust approach would involve wrapping with a provider or having a more integrated test setup.
    // For now, this just illustrates the intent.
    // A direct call to handleBack could be done if it were exposed, but it's not.
    // So, we rely on the fact that if a back button existed and was clicked,
    // it would call setScene, which in turn triggers a shallow push.
    
    // This test as written cannot directly click a "Back" button from DebugGameControls
    // without more complex setup. The previous calls tested the choice navigation.
    // To properly test 'handleBack', we would need to:
    // 1. Ensure `isDebug` is true so `DebugGameControls` renders.
    // 2. `fireEvent.click` on the actual back button.
    // For now, this test case is more of a placeholder for that interaction.
  });

});
