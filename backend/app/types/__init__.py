from typing import Dict, Any, List, Optional, Union

# Common Type Aliases for Backend Services
JsonDict = Dict[str, Any]
QueryParams = Dict[str, Union[str, int, float, bool]]
LocationRecord = Dict[str, Optional[str]]
ScrapedBusinessRecord = Dict[str, Optional[str]]
