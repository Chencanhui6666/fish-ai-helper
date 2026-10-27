import os
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain.messages import HumanMessage
from dotenv import load_dotenv
from pathlib import Path
from ..utils.debug import print_object

env_path = Path(__file__).resolve().parents[2] / ".env.dev"
load_dotenv(env_path)

API_KEY = os.getenv("DEEPSEEK_API_KEY")
BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

model = ChatOpenAI(
    model="deepseek-chat",
    api_key=API_KEY,
    base_url=BASE_URL,
)

agent = create_agent(
    model=model,
    tools=[],
    system_prompt="You're a helpful assistant that can answer questions and provide information.",
)

async def chat_events(msg: str):
    inputs = {
        "messages": [HumanMessage(content=msg)],
    }

    stream = agent.stream_events(inputs, version="v3")

    for item in stream.messages:
        print_object(item)
        print("-------------------------")
        for delta in item.text:
            yield {
                "type": "message",
                "payload": {
                    "message_id": item.message_id,
                    "content": delta,
                }, 
            }
    
    yield {"type": "done", "payload": {}}