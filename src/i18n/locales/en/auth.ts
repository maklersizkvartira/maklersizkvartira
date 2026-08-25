/**
 * Registration, verification, sign-in and password management.
 *
 * The flow the copy describes: name + phone + password -> SMS code ->
 * verification screen -> account created.
 */
export const auth = {
  tabs: {
    login: 'Sign in',
    register: 'Sign up',
  },

  role: {
    question: 'First, tell us who you are',
    hint: 'You can change this later in your profile.',
    owner: {
      title: 'I am a property owner',
      description: 'I want to rent out my flat directly, without a broker',
    },
    student: {
      title: 'I am looking for a flat',
      description: 'Looking for a place for a family, a student or shared / roommate living',
    },
    change: 'Change role',
    selected: 'You are signing up as {role}',
  },

  fields: {
    name: 'Your name',
    namePlaceholder: 'For example: Dilshod Karimov',
    nameHint: 'Owners trust a real name more.',
    phone: 'Your phone number',
    phonePlaceholder: '+998 90 123 45 67',
    phoneHint: 'The verification code will be sent to this number.',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    confirmPassword: 'Repeat password',
    confirmPlaceholder: 'Enter the password again',
    currentPassword: 'Current password',
    newPassword: 'New password',
    code: 'SMS verification code',
    codePlaceholder: '______',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    rememberMe: 'Remember me',
  },

  strength: {
    label: 'Password strength',
    veryWeak: 'Very weak',
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
    hint: 'Mix letters, numbers and symbols.',
  },

  login: {
    title: 'Sign in to your account',
    subtitle: 'With your phone number and password',
    submit: 'Sign in',
    submitting: 'Signing in...',
    forgotPassword: 'Forgot your password?',
    noAccount: 'No account yet?',
    createOne: 'Sign up',
    orDivider: 'or',
    withGoogle: 'Sign in with Google',
  },

  register: {
    title: 'Create a new account',
    subtitle: 'Sign up in a minute — no commission',
    submit: 'Continue',
    submitting: 'Sending code...',
    haveAccount: 'Already have an account?',
    signInInstead: 'Sign in',
    terms:
      'By signing up you agree to the Terms of Use and the Privacy Policy.',
    stepOf: 'Step {current} of {total}',
    steps: {
      details: 'Your details',
      verify: 'Verification',
      done: 'Done',
    },
  },

  verify: {
    title: 'Verify your phone number',
    subtitle: 'We sent a 6-digit code to {phone}',
    submit: 'Verify and finish',
    submitting: 'Checking...',
    resend: 'Resend code',
    resendIn: 'Resend in {seconds} s',
    resent: 'A new code has been sent',
    changePhone: 'Change number',
    expiresIn: 'The code is valid for {minutes} minutes',
    attemptsLeft: '{count} attempts left',
    devCode: 'Test mode — code: {code}',
    pasteHint: 'You can also paste the whole code.',
  },

  forgot: {
    title: 'Reset password',
    subtitle: 'Enter your phone number — we will send a code by SMS',
    submit: 'Send code',
    backToLogin: 'Back to sign in',
    codeSent: 'If this number is registered, a code has been sent.',
  },

  reset: {
    title: 'Set a new password',
    subtitle: 'Enter the SMS code and choose a new password',
    submit: 'Update password',
    success: 'Password updated. Now sign in with the new password.',
  },

  changePassword: {
    title: 'Change password',
    submit: 'Change password',
    success: 'Password changed. You have been signed out of other devices.',
    warning: 'If you change the password, you will be signed out of all other devices.',
  },

  success: {
    badge: 'Success!',
    registered: 'Welcome, {name}!',
    registeredBody:
      'Your account has been created and your phone number verified. You can now look for a flat without a broker.',
    loggedIn: 'Welcome, {name}',
    loggedInBody: 'You have signed in successfully.',
    welcomeTitle: 'Welcome, {name}!',
    welcomeThanks:
      'Thank you for registering with MaklersizUy and for choosing us.',
    welcomeDismiss: 'Tap to continue',
    redirecting: 'Redirecting...',
  },

  logout: {
    title: 'Confirm sign out',
    body: 'Do you want to sign out of your account?',
    confirm: 'Yes, sign out',
    allDevices: 'Sign out of all devices',
    success: 'You have been signed out.',
  },

  reregister: {
    title: 'Update your account',
    body:
      'Because of a security update you need to set a new password for your account. '
      + 'Sign up again with the same phone number — your listings and data will be kept.',
    cta: 'Sign up again',
  },

  guard: {
    title: 'Sign in to use this section',
    body: 'Sign in to your account to post a listing and contact property owners.',
    cta: 'Sign in or sign up',
  },

  errors: {
    nameRequired: 'Enter your name.',
    nameTooShort: 'The name must be at least 2 letters long.',
    nameHasDigits: 'The name must not contain digits.',
    phoneRequired: 'Enter your phone number.',
    phoneInvalid: 'The phone number is invalid. For example: +998 90 123 45 67',
    passwordRequired: 'Enter a password.',
    passwordTooShort: 'The password must be at least {min} characters long.',
    passwordTooSimple: 'The password is too simple. Use letters and numbers together.',
    passwordMismatch: 'The passwords do not match.',
    codeRequired: 'Enter the verification code.',
    codeIncomplete: 'Enter the full code.',
    roleRequired: 'Select a role first.',
    googleDomain:
      'Google sign-in is not configured for this address. Sign in with your phone number instead.',
    googleDisabled: 'Google sign-in is currently disabled.',
    googlePopupBlocked: 'Your browser blocked the window. Allow pop-ups and try again.',
    googleUnavailable: 'Google is unavailable right now. Sign in with your phone number.',
    googleOtherAccount: 'That email is already registered another way. Sign in with your phone number.',
    termsRequired: 'Accept the terms to continue.',
  },
} as const;
