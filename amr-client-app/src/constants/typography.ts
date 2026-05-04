import { TextStyle } from 'react-native';

const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  mono: 'monospace',
};

export const typography = {
  display: {
    fontFamily: fonts.bold,
    fontSize: 32,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  statValue: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.3,
  },
};
