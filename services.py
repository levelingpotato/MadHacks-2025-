import requests
import re
import json
import ast

# Public Judge0 URL
JUDGE0_URL = "https://ce.judge0.com/submissions?base64_encoded=false&wait=true"
LEETCODE_API = "https://alfa-leetcode-api.onrender.com/select?titleSlug={slug}"

# --- STABLE CONFIGURATION ---
# This dictionary maps the URL slug to the specific Python function name.
# This ensures the Test Runner calls the correct function.
PROBLEM_CONFIGS = {
    "two-sum": {"fn": "twoSum", "args": 2},
    "contains-duplicate": {"fn": "containsDuplicate", "args": 1},
    "valid-anagram": {"fn": "isAnagram", "args": 2},
    "missing-number": {"fn": "missingNumber", "args": 1},
    "single-number": {"fn": "singleNumber", "args": 1},
    "fizz-buzz": {"fn": "fizzBuzz", "args": 1},
    "palindrome-number": {"fn": "isPalindrome", "args": 1},
    "plus-one": {"fn": "plusOne", "args": 1}
}

def fetch_problem(slug):
    print(f"🔍 Fetching: {slug}...")
    try:
        # 1. Fetch Data
        url = LEETCODE_API.format(slug=slug)
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200: return None
        
        data = resp.json()
        html = data.get("question", "")
        title = data.get("questionTitle", "Unknown")

        # 2. Extract Test Cases (Regex Scraper)
        # Matches: Input: ... <br> Output: ...
        pattern = re.compile(r"Input:?</strong>\s*([\s\S]*?)\s*(?:<br>|\n)\s*<strong>\s*Output:?</strong>\s*([\s\S]*?)\s*(?:<br>|$)", re.IGNORECASE)
        matches = pattern.findall(html)
        
        test_cases = []
        for i, (inp_str, out_str) in enumerate(matches):
            clean_inp = re.sub(r"<[^>]+>", "", inp_str).strip()
            clean_out = re.sub(r"<[^>]+>", "", out_str).strip()
            test_cases.append({
                "id": i + 1,
                "input_text": clean_inp,
                "expected_text": clean_out
            })

        if not test_cases:
            print(f"⚠️ No test cases found for {slug}")
            return None

        # 3. Get Config (Critical Step)
        config = PROBLEM_CONFIGS.get(slug)
        if not config:
            print(f"⚠️ Missing config for {slug}. Add it to PROBLEM_CONFIGS in services.py")
            return None

        # 4. Construct Starter Code
        # We construct a simple starter template based on the config
        arg_str = ", ".join([f"arg{i}" for i in range(config['args'])])
        starter_code = f"class Solution:\n    def {config['fn']}(self, {arg_str}):\n        # Write your code here\n        pass"

        return {
            "slug": slug,
            "title": title,
            "description": html,
            "test_cases": test_cases,
            "config": config,
            "solution": starter_code
        }
    except Exception as e:
        print(f"❌ Error fetching {slug}: {e}")
        return None

def generate_test_harness(user_code, problem):
    """
    Wraps user code in a script that runs all test cases and prints JSON.
    """
    fn_name = problem["config"]["fn"]
    cases_json = json.dumps(problem["test_cases"])
    
    harness = f"""
import sys
import json
import ast

# --- 1. USER CODE ---
{user_code}

# --- 2. TEST RUNNER ---
def run_tests():
    cases = {cases_json}
    results = []
    
    try:
        sol = Solution()
    except Exception as e:
        print(json.dumps({{"error": "Init Error: " + str(e)}}))
        return

    for case in cases:
        inp_str = case["input_text"]
        exp_str = case["expected_text"]
        
        try:
            # Parse Inputs: "nums = [2,7], target = 9" -> [[2,7], 9]
            # Hacky parser to handle multi-argument inputs stringified
            if "=" in inp_str:
                parts = [p.split("=")[1].strip() for p in inp_str.split(", ")]
            else:
                parts = [inp_str]
            
            # Safe Eval to convert strings to Python Objects
            args = [ast.literal_eval(p) for p in parts]
            expected = ast.literal_eval(exp_str)
            
            # Run the Function
            actual = getattr(sol, "{fn_name}")(*args)
            
            results.append({{
                "id": case["id"],
                "passed": actual == expected,
                "input": inp_str,
                "expected": str(expected),
                "actual": str(actual)
            }})
        except Exception as e:
            results.append({{
                "id": case["id"],
                "passed": False,
                "input": inp_str,
                "expected": exp_str,
                "actual": str(e)
            }})

    # Output JSON for the backend to read
    print(json.dumps(results))

if __name__ == "__main__":
    run_tests()
"""
    return harness

def run_code_sync(code, problem):
    # 1. Generate the script
    script = generate_test_harness(code, problem)
    
    payload = {
        "source_code": script,
        "language_id": 71, # Python
        "stdin": ""        # Inputs are inside the script now
    }
    
    try:
        # 2. Send to Judge0
        resp = requests.post(JUDGE0_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        data = resp.json()
        
        # 3. Parse the Output
        if "stdout" in data and data["stdout"]:
            try:
                return {"tests": json.loads(data["stdout"])}
            except:
                return {"error": "Output Error", "raw": data["stdout"]}
        
        if "stderr" in data and data["stderr"]:
             return {"error": data["stderr"]}
             
        return {"error": data.get("compile_output", "Unknown Error")}
        
    except Exception as e:
        return {"error": f"Connection Error: {e}"}