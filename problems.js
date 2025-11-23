const problems = {
  easy: [
    {
      title: "Sum of Two Numbers",
      difficulty: "Easy",
      description:
        "Given two integers a and b, compute and print their sum.",
      input:
        "Two integers a and b separated by a space on a single line.",
      output:
        "A single integer: the value of a + b.",
      sampleInput: "2 5",
      sampleOutput: "7",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        int a = sc.nextInt();\n" +
"        int b = sc.nextInt();\n" +
"        System.out.println(a + b);\n" +
"    }\n" +
"}"
    },
    {
      title: "Echo the String",
      difficulty: "Easy",
      description:
        "Given a line of text, print exactly the same line.",
      input:
        "A single line of text (may contain spaces).",
      output:
        "Print the same line of text unchanged.",
      sampleInput: "hello world",
      sampleOutput: "hello world",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        if (sc.hasNextLine()) {\n" +
"            String s = sc.nextLine();\n" +
"            System.out.println(s);\n" +
"        }\n" +
"    }\n" +
"}"
    },
    {
      title: "Even or Odd",
      difficulty: "Easy",
      description:
        "Given an integer n, determine whether it is even or odd.",
      input:
        "A single integer n.",
      output:
        "Print 'even' if n is even, otherwise print 'odd'.",
      sampleInput: "7",
      sampleOutput: "odd",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        int n = sc.nextInt();\n" +
"        if (n % 2 == 0) System.out.println(\"even\");\n" +
"        else System.out.println(\"odd\");\n" +
"    }\n" +
"}"
    }
  ],

  medium: [
    {
      title: "Sum of an Array",
      difficulty: "Medium",
      description:
        "Given an integer n and an array of n integers, compute the sum of all elements.",
      input:
        "First line: integer n. Second line: n integers separated by spaces.",
      output:
        "A single integer: the sum of the n integers.",
      sampleInput: "5\n1 2 3 4 5",
      sampleOutput: "15",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        int n = sc.nextInt();\n" +
"        long sum = 0;\n" +
"        for (int i = 0; i < n; i++) sum += sc.nextInt();\n" +
"        System.out.println(sum);\n" +
"    }\n" +
"}"
    },
    {
      title: "Count Vowels",
      difficulty: "Medium",
      description:
        "Given a string, count how many vowels appear in it.",
      input:
        "A single line string.",
      output:
        "A single integer: number of vowels.",
      sampleInput: "Hello World",
      sampleOutput: "3",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        String s = sc.nextLine().toLowerCase();\n" +
"        int count = 0;\n" +
"        String vowels = \"aeiou\";\n" +
"        for (char c : s.toCharArray()) {\n" +
"            if (vowels.indexOf(c) != -1) count++;\n" +
"        }\n" +
"        System.out.println(count);\n" +
"    }\n" +
"}"
    },
    {
      title: "Reverse the String",
      difficulty: "Medium",
      description:
        "Given a string, reverse it.",
      input:
        "A single line string.",
      output:
        "The reversed string.",
      sampleInput: "abcde",
      sampleOutput: "edcba",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        String s = sc.nextLine();\n" +
"        StringBuilder sb = new StringBuilder(s);\n" +
"        System.out.println(sb.reverse().toString());\n" +
"    }\n" +
"}"
    }
  ],

  hard: [
    {
      title: "Count Distinct Numbers",
      difficulty: "Hard",
      description:
        "Given n numbers, count how many distinct values appear.",
      input:
        "First line: n. Second line: n integers.",
      output:
        "A single integer: number of distinct values.",
      sampleInput: "6\n1 2 2 3 3 3",
      sampleOutput: "3",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        int n = sc.nextInt();\n" +
"        Set<Integer> set = new HashSet<>();\n" +
"        for (int i = 0; i < n; i++) set.add(sc.nextInt());\n" +
"        System.out.println(set.size());\n" +
"    }\n" +
"}"
    },
    {
      title: "Two Sum (Indices)",
      difficulty: "Hard",
      description:
        "Find two indices i and j such that arr[i] + arr[j] = t.",
      input:
        "n, array of n integers, and target t.",
      output:
        "Two indices i and j (0-based).",
      sampleInput: "4\n2 7 11 15\n9",
      sampleOutput: "0 1",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        int n = sc.nextInt();\n" +
"        int[] arr = new int[n];\n" +
"        for (int i = 0; i < n; i++) arr[i] = sc.nextInt();\n" +
"        int target = sc.nextInt();\n" +
"        Map<Integer, Integer> map = new HashMap<>();\n" +
"        for (int i = 0; i < n; i++) {\n" +
"            int needed = target - arr[i];\n" +
"            if (map.containsKey(needed)) {\n" +
"                System.out.println(map.get(needed) + \" \" + i);\n" +
"                return;\n" +
"            }\n" +
"            map.put(arr[i], i);\n" +
"        }\n" +
"    }\n" +
"}"
    },
    {
      title: "Longest Word Length",
      difficulty: "Hard",
      description:
        "Find the length of the longest word in a sentence.",
      input:
        "A sentence.",
      output:
        "Length of the longest word.",
      sampleInput: "I love competitive programming",
      sampleOutput: "11",
      solution:
"import java.util.*;\n" +
"public class Main {\n" +
"    public static void main(String[] args) {\n" +
"        Scanner sc = new Scanner(System.in);\n" +
"        String sentence = sc.nextLine();\n" +
"        String[] words = sentence.split(\" \");\n" +
"        int max = 0;\n" +
"        for (String w : words) {\n" +
"            if (w.length() > max) max = w.length();\n" +
"        }\n" +
"        System.out.println(max);\n" +
"    }\n" +
"}"
    }
  ]
};
