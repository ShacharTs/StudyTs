import { TextButton, type TextButtonProps } from './TextButton';

// A button that is always on or off: pressed is required, so a toggle can never lose its state mark.
export const ToggleButton = (props: TextButtonProps & { pressed: boolean }) => <TextButton {...props} />;
