// Dark mode is not ready yet — force light scheme across all platforms (matches the native hook).
export function useColorScheme(): 'light' {
  return 'light';
}
